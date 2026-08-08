'use server';

import { returnValidationErrors } from 'next-safe-action';

import { sendPolicyUpdatedEmail } from '@/lib/resend/send-policy-emails';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { authActionClient } from '@/lib/server/safe-action';
import Logger from '@/utils/logger';

import { appConfig } from '@/config/app';
import { paths } from '@/constants/paths';
import {
  acknowledgePolicySchema,
  createPolicySchema,
  deletePolicySchema,
  DUPLICATE_TITLE_MESSAGE,
  publishPolicyVersionSchema,
} from '@/schema/policy';
import { markReviewedSchema } from '@/schema/policy-linkage';

/** Admin gate. Server-side even though `public.is_admin()` guards both RPCs and
 *  the `*_admin_all` RLS policies — defense in depth, mirroring
 *  `actions/system-config.ts`. */
const requireAdmin = (role?: string) => {
  if (role !== 'admin') throw new Error('Forbidden');
};

/**
 * Create a policy and publish its version 1 (admin only). Both rows land in a
 * single transaction inside `create_policy` — a plain insert followed by a
 * separate publish could leave a policy with no versions behind.
 *
 * The CKEditor body is sanitized here, before it reaches the database, so only
 * clean markup is ever persisted (stored-XSS guard).
 */
export const createPolicy = authActionClient
  .schema(createPolicySchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data, error } = await supabase.rpc('create_policy', {
      p_title: parsedInput.title,
      p_category: parsedInput.category,
      p_body_html: sanitizeHtml(parsedInput.contentHtml),
    });
    if (error) {
      // `slug` is the only unique column left on `policies` — it is derived
      // from the title — so a 23505 here means the title is already taken, not
      // the category. Categories are a grouping label and may repeat.
      if (error.code === '23505') {
        returnValidationErrors(createPolicySchema, {
          title: { _errors: [DUPLICATE_TITLE_MESSAGE] },
        });
      }
      throw new Error(error.message);
    }

    return data;
  });

/**
 * Publish a new version of an existing policy (admin only). Never sets
 * `version` or `is_active` itself: `publish_policy_version` computes the next
 * version number and deactivates the previous active row in one transaction,
 * so history stays append-only and exactly one version is ever active.
 */
export const publishPolicyVersion = authActionClient
  .schema(publishPolicyVersionSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data, error } = await supabase.rpc('publish_policy_version', {
      p_policy_id: parsedInput.policyId,
      p_body_html: sanitizeHtml(parsedInput.bodyHtml),
    });
    if (error) throw new Error(error.message);

    // The policy version is already published before email work starts. A
    // Resend failure must not roll back the update or prevent its in-app
    // notification trigger from reaching employees.
    try {
      const [
        { data: policy, error: policyError },
        { data: employees, error: employeesError },
      ] = await Promise.all([
        supabase
          .from('policies')
          .select('title')
          .eq('id', parsedInput.policyId)
          .single(),
        supabase
          .from('employees')
          .select('email, full_name')
          .eq('account_status', 'active'),
      ]);

      if (policyError) throw policyError;
      if (employeesError) throw employeesError;

      const policyUrl = new URL(
        paths.employee.policyDetail(parsedInput.policyId),
        appConfig.appUrl,
      ).toString();
      const results = await Promise.allSettled(
        (employees ?? []).map((employee) =>
          sendPolicyUpdatedEmail({
            to: employee.email,
            fullName: employee.full_name,
            policyTitle: policy.title,
            policyUrl,
          }),
        ),
      );
      results.forEach((result) => {
        if (result.status === 'rejected') {
          Logger.error('Failed to send policy update email', result.reason);
        }
      });
    } catch (emailError) {
      Logger.error('Failed to prepare policy update emails', emailError);
    }

    return data;
  });

/** Delete a policy document and all of the history it owns (admin only).
 * `policy_versions`, their acknowledgments, and the policy's reconciliation
 * marker are all foreign-key dependents with database-level cascades. */
export const deletePolicy = authActionClient
  .schema(deletePolicySchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data, error } = await supabase
      .from('policies')
      .delete()
      .eq('id', parsedInput.policyId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Policy not found');

    return { id: data.id };
  });

/** A repeat acknowledgment trips `unique (employee_id, policy_version_id)`.
 *  That's the intended outcome, not a failure: the employee's signature against
 *  this version is already on file, so the row we'd insert is the row that
 *  exists. Swallowed here to keep double-clicking "I acknowledge" harmless. */
const DUPLICATE_ACKNOWLEDGMENT = '23505';

/**
 * Record the signed-in employee's acknowledgment of a policy version (PRD §6.3).
 * Idempotent, and self-scoped in two independent places:
 *
 *   * `employee_id` is taken from the session here — the input schema has no
 *     such field, so there is nothing for a caller to forge.
 *   * the `ack_insert_own` RLS `with check` re-derives it from `auth.uid()` and
 *     additionally requires the version to still be active, so a stale prompt
 *     can't record an acknowledgment against a superseded version.
 *
 * Neither guard depends on the other holding.
 */
export const acknowledgePolicy = authActionClient
  .schema(acknowledgePolicySchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    const employeeId = authUser.user?.id;
    if (!employeeId) throw new Error('Unauthorized');

    const { error } = await supabase.from('policy_acknowledgments').insert({
      employee_id: employeeId,
      policy_version_id: parsedInput.policyVersionId,
    });
    if (error && error.code !== DUPLICATE_ACKNOWLEDGMENT) {
      throw new Error(error.message);
    }

    return { success: true };
  });

/**
 * Advance a policy's reconciliation marker to its current active version (admin
 * only) — the "Mark reviewed" action behind the linkage panel (BIT-25, M3.5).
 *
 * This records only that the admin has re-read the policy against the rule it
 * governs; it never writes `payroll_settings`, so reconciling a drifted policy
 * changes no enforced value (the PRD's flag-drift/manual-reconcile resolution).
 * The version reconciled to is re-derived here from the active row rather than
 * trusted from the client, and the upsert keys on the `policy_id` primary key so
 * it's idempotent and moves an existing marker forward in place.
 */
export const markPolicyReviewed = authActionClient
  .schema(markReviewedSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: active, error: activeError } = await supabase
      .from('policy_versions')
      .select('id')
      .eq('policy_id', parsedInput.policyId)
      .eq('is_active', true)
      .single();
    if (activeError) throw new Error(activeError.message);

    const { error } = await supabase.from('policy_reconciliations').upsert({
      policy_id: parsedInput.policyId,
      reconciled_version_id: active.id,
      reconciled_by: authUser.user?.id,
      reconciled_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    return { success: true };
  });
