'use server';

import { sendPasswordResetEmail } from '@/lib/resend/send-password-reset-email';
import { authActionClient, safeActionClient } from '@/lib/server/safe-action';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { appConfig } from '@/config/app';
import { paths } from '@/constants/paths';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '@/schema/auth';

/** Email + password sign-in. The Supabase server client writes the session
 *  cookies; the caller refreshes to pick them up and routes into the app. */
export const signInWithPassword = safeActionClient
  .schema(loginSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    // Uniform message — never reveal whether it was the email or the password.
    if (error) {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('account_status')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      if (employee?.account_status === 'disabled') {
        throw new Error(
          'This account has been disabled and can no longer be accessed. Please contact your administrator if you think this is a mistake.',
        );
      }
      throw new Error('Invalid email or password');
    }
    // Role decides which app the caller lands in (mirrored into app_metadata
    // from employees.role). The middleware enforces the same split on every
    // subsequent request.
    const isAdmin = data.user?.app_metadata?.role === 'admin';
    return { role: isAdmin ? ('admin' as const) : ('employee' as const) };
  });

/**
 * Sends a password-recovery email, or reports that no account exists for the
 * address. The result is a discriminated status the "Forgot password?" screen
 * renders as one of two cards: `not_found` (no matching account) or `sent`.
 *
 * Delivered through Resend, not Supabase's own mailer — mirroring the invite
 * flow (`inviteEmployee` / `sendInviteEmail`). We mint the recovery link with
 * the service-role admin API (`generateLink`), which returns a one-time
 * `hashed_token` without triggering Supabase's unbranded mailer, then point it
 * at `/auth/reset-password?token_hash=…&type=recovery` and send our own branded
 * template. The reset page exchanges that token for a recovery session via
 * `verifyOtp` on arrival (see `RecoveryTokenVerifier`).
 *
 * Note: reporting `not_found` intentionally reveals whether an email is
 * registered (an account-enumeration surface) — a deliberate product choice for
 * clearer UX over the anti-enumeration "if an account exists" phrasing.
 */
export const requestPasswordReset = safeActionClient
  .schema(forgotPasswordSchema)
  .action(async ({ parsedInput: { email } }) => {
    // Match how Supabase auth stores emails (lower-cased) so the lookup resolves
    // the account reliably.
    const normalizedEmail = email.trim().toLowerCase();

    // `employees` is the app's source of truth for who has an account (every
    // auth user is created with a paired row), so it decides send vs not-found.
    const { data: employee, error: lookupError } = await supabaseAdmin
      .from('employees')
      .select('full_name, account_status')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (lookupError) {
      throw new Error('Something went wrong. Please try again.');
    }
    if (!employee) {
      return { status: 'not_found' as const };
    }
    if (employee.account_status === 'disabled') {
      // A reset must not become a misleading recovery path for an account that
      // has intentionally lost access. Re-enabling restores this route.
      return { status: 'disabled' as const };
    }

    // Mint the one-time recovery link (no Supabase mailer is triggered) and
    // deliver our branded template. A failure now surfaces to the caller — with
    // enumeration protection dropped, there's no reason to hide a real outage.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
    });
    if (error || !data.properties) {
      throw new Error('Could not send the reset email. Please try again.');
    }

    const resetUrl = new URL(paths.auth.resetPassword, appConfig.appUrl);
    resetUrl.searchParams.set('token_hash', data.properties.hashed_token);
    resetUrl.searchParams.set('type', 'recovery');

    await sendPasswordResetEmail({
      to: normalizedEmail,
      fullName: employee.full_name,
      resetUrl: resetUrl.toString(),
    });

    return { status: 'sent' as const };
  });

/** Sets a new password for the user in the current (recovery) session. */
export const updatePassword = authActionClient
  .schema(resetPasswordSchema)
  .action(async ({ parsedInput: { password }, ctx: { supabase } }) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(
        'Could not update your password. The reset link may have expired — request a new one.',
      );
    }
  });

/** Clears the session cookies. The caller routes back to /auth/login. */
export const signOut = authActionClient.action(
  async ({ ctx: { supabase } }) => {
    await supabase.auth.signOut();
  },
);
