'use server';

import { sendOnboardingInvite } from '@/lib/email/send-onboarding-invite';
import { authActionClient } from '@/lib/server/safe-action';
import { supabaseAdmin } from '@/lib/supabase/admin';

import { appConfig } from '@/config/app';
import { paths } from '@/constants/paths';
import {
  contactInfoWithIdSchema,
  employeeIdField,
  employeeIdSchema,
  employmentConfigSchema,
  inviteEmployeeSchema,
} from '@/schema/employee';
import { bankInfoSchema, socialAccountsSchema } from '@/schema/onboarding';

/** Admin gate for every action below. The role check is server-side even though
 *  RLS also enforces it: app_metadata.role is the routing contract mirrored from
 *  employees.role by mirror_role_to_jwt() (BIT-3). */
const requireAdmin = (role?: string) => {
  if (role !== 'admin') throw new Error('Forbidden');
};

/**
 * Admin-only. Bring a person into the system by email invite — there is no
 * self-signup.
 *
 * This is a two-system write with no cross-system transaction: `auth.users`
 * and `public.employees` live behind different APIs, so atomicity is emulated.
 * Create the auth user first (service-role admin API), then insert the paired
 * employees row; if the row insert fails, delete the just-created auth user so
 * no orphaned account remains. Order matters — inserting the row first would
 * orphan it if the auth invite failed.
 */
export const inviteEmployee = authActionClient
  .schema(inviteEmployeeSchema)
  .action(async ({ parsedInput: { email, fullName }, ctx: { authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    // Collapse a blank/whitespace name to null so the row stores null, not ''.
    const name = fullName?.trim() || null;
    // Normalise to match how Supabase auth stores emails (lower-cased). Keeps
    // the existence guard below reliable and stops a case-only variant from
    // creating a second row for the same person.
    const normalizedEmail = email.trim().toLowerCase();

    // Guard the re-invite case explicitly. Every invited/active person already
    // has an `employees` row, so an existing row means this email is spent.
    // Checking here — before we create anything — matters for correctness AND
    // safety: `generateLink` returns the *existing* auth user for an
    // already-registered email rather than erroring, so without this guard we
    // would fall through to the insert below, hit a duplicate-key error, and
    // then the compensating `deleteUser` would CASCADE-delete this person's
    // real employees row (and every satellite) via the ON DELETE CASCADE FK.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('employees')
      .select('account_status')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existingError) {
      throw new Error('Could not send the invitation. Please try again.');
    }
    if (existing) {
      throw new Error(
        existing.account_status === 'invited'
          ? 'This person has already been invited. Use Resend on their row to send a new link.'
          : 'An employee with this email already exists.',
      );
    }

    // generateLink creates the auth.users row without sending Supabase's own
    // (unbrandable) mailer email. We build our own /auth/accept-invitation link
    // from the returned hashed_token and deliver it ourselves via Resend; the
    // accept page exchanges the token for a session on arrival.
    const { data: invited, error: inviteError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: normalizedEmail,
        options: { data: name ? { full_name: name } : undefined },
      });
    if (inviteError || !invited.user) {
      // Don't surface the raw auth error; the most common cause is an email
      // that has already been invited.
      throw new Error('Could not send the invitation. Please try again.');
    }

    const inviteUrl = new URL(paths.auth.acceptInvitation, appConfig.appUrl);
    inviteUrl.searchParams.set('token_hash', invited.properties.hashed_token);
    inviteUrl.searchParams.set('type', 'invite');

    try {
      await sendOnboardingInvite({
        to: normalizedEmail,
        employeeName: name ?? '',
        onboardingLink: inviteUrl.toString(),
      });
    } catch {
      // The auth user exists but nobody can ever receive the link — roll back.
      await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      throw new Error('Could not send the invitation. Please try again.');
    }

    const { error: rowError } = await supabaseAdmin.from('employees').insert({
      id: invited.user.id,
      email: normalizedEmail,
      full_name: name,
      role: 'employee',
      account_status: 'invited',
      invited_at: new Date().toISOString(),
    });
    if (rowError) {
      // A unique violation (23505) means the account already exists — a race
      // with a concurrent invite, or a pre-existing auth user `generateLink`
      // handed back. That user is NOT ours to remove, so we must never delete
      // it: doing so would CASCADE-delete a real employees row. Only roll back
      // when the insert failed for some other reason, where the auth user we
      // just created would otherwise be orphaned.
      if (rowError.code !== '23505') {
        await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
        throw new Error(
          'Could not create the employee record. Please try again.',
        );
      }
      throw new Error('An employee with this email already exists.');
    }

    return { id: invited.user.id };
  });

/**
 * Admin-only. Re-send a pending invitation. Guarded to `invited` only — once the
 * person accepts, the invite is spent and they manage their own account.
 *
 * The original invite used a one-time `invite` link, which Supabase won't re-mint
 * for an already-existing auth user. A fresh `magiclink` reaches the same
 * /auth/accept-invitation flow (the accept page verifies either token type) and
 * lets them set a password — the accept page still gates on `invited` status.
 */
export const resendInvite = authActionClient
  .schema(employeeIdSchema)
  .action(async ({ parsedInput: { employeeId }, ctx: { authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: employee, error: readError } = await supabaseAdmin
      .from('employees')
      .select('email, full_name, account_status')
      .eq('id', employeeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!employee) throw new Error('Employee not found.');
    if (employee.account_status !== 'invited') {
      throw new Error('This person has already accepted their invitation.');
    }

    const { data: link, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: employee.email,
      });
    if (linkError || !link.properties) {
      throw new Error('Could not resend the invitation. Please try again.');
    }

    const inviteUrl = new URL(paths.auth.acceptInvitation, appConfig.appUrl);
    inviteUrl.searchParams.set('token_hash', link.properties.hashed_token);
    inviteUrl.searchParams.set('type', 'magiclink');

    try {
      await sendOnboardingInvite({
        to: employee.email,
        employeeName: employee.full_name ?? '',
        onboardingLink: inviteUrl.toString(),
      });
    } catch {
      throw new Error('Could not resend the invitation. Please try again.');
    }

    // Re-stamp so the directory's "Invited" date reflects the latest send.
    await supabaseAdmin
      .from('employees')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', employeeId);
  });

/**
 * Admin-only. Revoke a pending invitation before it's accepted — deletes both
 * halves of the paired account: the `employees` row (which cascades to its
 * satellite tables) and the `auth.users` row. There is no FK between the two
 * (see `inviteEmployee`), so each side is deleted explicitly. Guarded to
 * `invited` only: an onboarding/active employee is managed, not un-invited.
 */
export const cancelInvite = authActionClient
  .schema(employeeIdSchema)
  .action(async ({ parsedInput: { employeeId }, ctx: { authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: employee, error: readError } = await supabaseAdmin
      .from('employees')
      .select('account_status')
      .eq('id', employeeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!employee) throw new Error('Employee not found.');
    if (employee.account_status !== 'invited') {
      throw new Error('Only a pending invitation can be cancelled.');
    }

    // The status guard on the delete keeps it a no-op if the invite was accepted
    // in the meantime, rather than racing the auth-user deletion below.
    const { error: rowError } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .eq('account_status', 'invited');
    if (rowError) throw new Error(rowError.message);

    // Remove the paired auth user so the email is free to be invited again.
    const { error: authError } =
      await supabaseAdmin.auth.admin.deleteUser(employeeId);
    if (authError) throw new Error(authError.message);
  });

/**
 * Disable an employee without deleting their Auth identity, HR history, or
 * stored documents. Supabase Auth rejects future sign-ins; the database state
 * is retained so a later re-enable restores the exact lifecycle status.
 */
export const disableEmployee = authActionClient
  .schema(employeeIdSchema)
  .action(async ({ parsedInput: { employeeId }, ctx: { authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: employee, error: readError } = await supabaseAdmin
      .from('employees')
      .select('role, account_status')
      .eq('id', employeeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!employee) throw new Error('Employee not found.');
    if (employee.role !== 'employee') {
      throw new Error('Administrator accounts cannot be disabled here.');
    }
    if (employee.account_status === 'disabled') {
      throw new Error('This employee is already disabled.');
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      employeeId,
      { ban_duration: '876000h' },
    );
    if (authError) throw new Error(authError.message);

    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        account_status: 'disabled',
        disabled_at: new Date().toISOString(),
        disabled_by: authUser.user.id,
        disabled_from_status: employee.account_status,
      })
      .eq('id', employeeId)
      .neq('account_status', 'disabled');
    if (updateError) {
      await supabaseAdmin.auth.admin.updateUserById(employeeId, {
        ban_duration: 'none',
      });
      throw new Error(updateError.message);
    }
  });

/** Re-enable a previously disabled employee and restore their pre-disable
 * lifecycle state. The restore value is recorded at disable time, never guessed. */
export const enableEmployee = authActionClient
  .schema(employeeIdSchema)
  .action(async ({ parsedInput: { employeeId }, ctx: { authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: employee, error: readError } = await supabaseAdmin
      .from('employees')
      .select(
        'role, account_status, disabled_at, disabled_by, disabled_from_status',
      )
      .eq('id', employeeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!employee) throw new Error('Employee not found.');
    if (employee.role !== 'employee') {
      throw new Error('Administrator accounts cannot be enabled here.');
    }
    if (
      employee.account_status !== 'disabled' ||
      !employee.disabled_from_status
    ) {
      throw new Error('This employee is not disabled.');
    }

    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({
        account_status: employee.disabled_from_status,
        disabled_at: null,
        disabled_by: null,
        disabled_from_status: null,
      })
      .eq('id', employeeId)
      .eq('account_status', 'disabled');
    if (updateError) throw new Error(updateError.message);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      employeeId,
      { ban_duration: 'none' },
    );
    if (authError) {
      await supabaseAdmin
        .from('employees')
        .update({
          account_status: 'disabled',
          disabled_at: employee.disabled_at,
          disabled_by: employee.disabled_by,
          disabled_from_status: employee.disabled_from_status,
        })
        .eq('id', employeeId);
      throw new Error(authError.message);
    }
  });

// ---------------------------------------------------------------------------
// Admin profile editor (BIT-10). Each write targets one satellite of an
// arbitrary employee and runs as the admin (RLS *_admin policies). None touch
// a protected column, so guard_employee_columns() passes without a bypass.
// bank/socials/employment upsert because the row may not exist yet for an
// employee who is still onboarding.
// ---------------------------------------------------------------------------

/** Contact fields on the employees row. */
export const updateEmployeeContact = authActionClient
  .schema(contactInfoWithIdSchema)
  .action(
    async ({
      parsedInput: {
        employeeId,
        phone,
        emergencyContact,
        address,
        city,
        postalCode,
      },
      ctx: { supabase, authUser },
    }) => {
      requireAdmin(authUser.user?.app_metadata.role);
      const { error } = await supabase
        .from('employees')
        .update({
          phone,
          emergency_contact: emergencyContact,
          address,
          city,
          postal_code: postalCode,
        })
        .eq('id', employeeId);
      if (error) throw new Error(error.message);
    },
  );

/** Bank details satellite. */
export const updateEmployeeBank = authActionClient
  .schema(bankInfoSchema.extend({ employeeId: employeeIdField }))
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase.from('bank_details').upsert({
      employee_id: parsedInput.employeeId,
      bank_name: parsedInput.bankName,
      account_holder: parsedInput.accountHolderName,
      account_number: parsedInput.accountNumber,
      iban: parsedInput.iban,
      bank_branch: parsedInput.branch ?? null,
    });
    if (error) throw new Error(error.message);
  });

/** Socials satellite. */
export const updateEmployeeSocials = authActionClient
  .schema(socialAccountsSchema.extend({ employeeId: employeeIdField }))
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase.from('socials').upsert({
      employee_id: parsedInput.employeeId,
      github_url: parsedInput.github,
      linkedin_url: parsedInput.linkedin,
      twitter_url: parsedInput.twitter || null,
    });
    if (error) throw new Error(error.message);
  });

/** Employment & payroll configuration satellite (PRD 4.1). */
export const updateEmploymentDetails = authActionClient
  .schema(employmentConfigSchema.extend({ employeeId: employeeIdField }))
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase.from('employment_details').upsert({
      employee_id: parsedInput.employeeId,
      employment_type: parsedInput.employmentType,
      base_salary: parsedInput.baseSalary,
      working_hours: parsedInput.workingHours,
      designation: parsedInput.designation,
      department: parsedInput.department || null,
      // null = inherit the global setting (the schema maps a blank field to null,
      // so a real 0 override is preserved while empty falls back to global).
      leave_pool_days_override: parsedInput.leavePoolDaysOverride ?? null,
      medical_accrual_monthly_override:
        parsedInput.medicalAccrualMonthlyOverride ?? null,
      medical_cap_override: parsedInput.medicalCapOverride ?? null,
      ot_multiplier_override: parsedInput.otMultiplierOverride ?? null,
    });
    if (error) throw new Error(error.message);
  });

/** Clears only the employee-specific allowance values so the balance logic
 * resumes inheriting the company-wide settings. */
export const resetEmployeeAllowanceOverrides = authActionClient
  .schema(employeeIdSchema)
  .action(async ({ parsedInput: { employeeId }, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase
      .from('employment_details')
      .update({
        leave_pool_days_override: null,
        medical_accrual_monthly_override: null,
        medical_cap_override: null,
        ot_multiplier_override: null,
      })
      .eq('employee_id', employeeId);
    if (error) throw new Error(error.message);
  });
