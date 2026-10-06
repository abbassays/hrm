'use server';

import { sendPasswordResetEmail } from '@/lib/resend/send-password-reset-email';
import {
  clearImpersonationCookie,
  getActiveImpersonation,
} from '@/lib/server/impersonation';
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

export const signInWithPassword = safeActionClient
  .schema(loginSchema)
  .action(async ({ parsedInput: { email, password } }) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    // Uniform message — never reveal whether the email or the password was wrong.
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
    // Role decides which app the caller lands in; the middleware enforces the
    // same split on every subsequent request.
    const isAdmin = data.user?.app_metadata?.role === 'admin';
    return { role: isAdmin ? ('admin' as const) : ('employee' as const) };
  });

export const requestPasswordReset = safeActionClient
  .schema(forgotPasswordSchema)
  .action(async ({ parsedInput: { email } }) => {
    const normalizedEmail = email.trim().toLowerCase();

    // Every auth user is created with a paired row, so `employees` decides
    // send vs not-found.
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
    // A reset must not become a recovery path for an account that intentionally
    // lost access. Re-enabling restores this route.
    if (employee.account_status === 'disabled') {
      return { status: 'disabled' as const };
    }

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

export const signOut = authActionClient.action(
  async ({ ctx: { supabase, authUser } }) => {
    const userId = authUser.user?.id;
    const active = userId ? await getActiveImpersonation(userId) : null;
    if (active) {
      // A borrowed session must not log the real person out of their own
      // devices, so revoke only this one.
      await Promise.all([
        clearImpersonationCookie(),
        supabase.auth.signOut({ scope: 'local' }),
      ]);
      return;
    }
    await supabase.auth.signOut();
  },
);
