'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  clearImpersonationCookie,
  getActiveImpersonation,
  setImpersonationCookie,
} from '@/lib/server/impersonation';
import { authActionClient } from '@/lib/server/safe-action';
import { supabaseAdmin } from '@/lib/supabase/admin';

import { paths } from '@/constants/paths';
import { employeeIdSchema } from '@/schema/employee';
import { stopImpersonationSchema } from '@/schema/impersonation';

import type { Database } from '@/types/supabase';

const SWITCH_FAILED = 'Could not switch accounts. Please try again.';

// The cause stays in the server log; the toast only says which step failed.
function fail(step: string, cause: unknown): never {
  console.error(`[impersonation] ${step} failed`, cause);
  throw new Error(`${SWITCH_FAILED} (${step})`);
}

// Defense in depth: RLS enforces the same thing.
const requireAdmin = (role?: string) => {
  if (role !== 'admin') throw new Error('Forbidden');
};

// Replaces the cookie session with one for `email`, no password involved: a
// one-time magic link minted by the service role and consumed right here.
async function signInAs(supabase: SupabaseClient<Database>, email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data.properties) fail('mint link', error);

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyError) fail('verify link', verifyError);
}

// Only this browser's session is revoked; the person's other devices stay in.
async function revokeSession(accessToken: string | undefined) {
  if (!accessToken) return;
  await supabaseAdmin.auth.admin.signOut(accessToken, 'local');
}

export const startImpersonation = authActionClient
  .schema(employeeIdSchema)
  .action(
    async ({ parsedInput: { employeeId }, ctx: { supabase, authUser } }) => {
      const admin = authUser.user;
      requireAdmin(admin?.app_metadata.role);
      if (!admin) throw new Error('Unauthorized');
      if (employeeId === admin.id) {
        throw new Error('You cannot impersonate yourself.');
      }

      const { data: target, error } = await supabaseAdmin
        .from('employees')
        .select('email, full_name, account_status')
        .eq('id', employeeId)
        .maybeSingle();
      if (error) fail('load employee', error);
      if (!target) throw new Error('Employee not found.');
      // Disabling bans the auth user, so no session can be minted for them.
      if (target.account_status === 'disabled') {
        throw new Error('This account is disabled. Re-enable it first.');
      }

      const {
        data: { session: adminSession },
      } = await supabase.auth.getSession();

      await signInAs(supabase, target.email);

      await Promise.all([
        setImpersonationCookie({ adminId: admin.id, targetId: employeeId }),
        revokeSession(adminSession?.access_token),
      ]);

      return { targetName: target.full_name || target.email };
    },
  );

export const stopImpersonation = authActionClient
  .schema(stopImpersonationSchema)
  .action(async ({ ctx: { supabase, authUser } }) => {
    const user = authUser.user;
    if (!user) throw new Error('Unauthorized');

    const active = await getActiveImpersonation(user.id);
    if (!active) {
      await clearImpersonationCookie();
      throw new Error('No admin session to return to. Please sign in again.');
    }

    const { data: admin, error } = await supabaseAdmin
      .from('employees')
      .select('email, role, account_status')
      .eq('id', active.adminId)
      .maybeSingle();
    if (error) fail('load admin', error);
    if (
      !admin ||
      admin.role !== 'admin' ||
      admin.account_status === 'disabled'
    ) {
      await clearImpersonationCookie();
      throw new Error(
        'Your admin account is no longer available. Please sign in again.',
      );
    }

    const {
      data: { session: employeeSession },
    } = await supabase.auth.getSession();

    await signInAs(supabase, admin.email);

    await Promise.all([
      clearImpersonationCookie(),
      revokeSession(employeeSession?.access_token),
    ]);

    return {
      returnTo:
        active.targetRole === 'employee'
          ? paths.admin.employeeDetail(active.targetId)
          : paths.admin.dashboard,
    };
  });
