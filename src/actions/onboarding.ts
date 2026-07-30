'use server';

import { authActionClient } from '@/lib/server/safe-action';

import { acceptInvitationSchema } from '@/schema/auth';
import {
  bankInfoSchema,
  consentSchema,
  personalInfoSchema,
  socialAccountsSchema,
} from '@/schema/onboarding';

/**
 * Invite-link landing. The invitee arrives already in a Supabase session
 * established by the emailed link (verified via /auth/callback). They set a
 * password — which signs them in for good — and then advance their own row
 * `invited → onboarding` via the caller-only `accept_onboarding()` RPC.
 *
 * The action runs as the caller (RLS + RPC), never service-role:
 * `accept_onboarding()` is security-definer and self-scoped, so it can only
 * advance the caller's own invite and only from the `invited` state.
 */
export const acceptInvite = authActionClient
  .schema(acceptInvitationSchema)
  .action(async ({ parsedInput: { password }, ctx: { supabase } }) => {
    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });
    if (passwordError) {
      throw new Error(
        'Could not set your password. The invitation link may have expired — ask your admin to resend it.',
      );
    }

    const { error: rpcError } = await supabase.rpc('accept_onboarding');
    if (rpcError) {
      throw new Error('Could not complete your invitation. Please try again.');
    }
  });

// ---------------------------------------------------------------------------
// Onboarding wizard — per-section autosave, keyed on the caller (auth.uid()).
//
// Every write runs as the caller (RLS), never service-role. The `employees`
// row already exists (created at invite), so section 1 is a plain UPDATE;
// bank_details / socials rows may not exist yet, so those sections UPSERT.
// None of these touch a protected column (role / account_status), so they
// pass guard_employee_columns() without any bypass.
// ---------------------------------------------------------------------------

/** Section 1 · Personal. Plain update of the caller's own employees row. */
export const savePersonal = authActionClient
  .schema(personalInfoSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    const userId = authUser.user?.id;
    if (!userId) throw new Error('Unauthorized');
    const { error } = await supabase
      .from('employees')
      .update({
        full_name: parsedInput.fullName,
        date_of_birth: parsedInput.dateOfBirth,
        phone: parsedInput.phone,
        emergency_contact: parsedInput.emergencyContact,
        address: parsedInput.address,
        city: parsedInput.city,
        postal_code: parsedInput.postalCode,
        cnic: parsedInput.cnic,
      })
      .eq('id', userId); // RLS employees_update_self
    if (error) throw new Error(error.message);
  });

/** Section 2 · Bank. Upsert — the bank_details row may not exist yet. */
export const saveBank = authActionClient
  .schema(bankInfoSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    const userId = authUser.user?.id;
    if (!userId) throw new Error('Unauthorized');
    const { error } = await supabase.from('bank_details').upsert({
      employee_id: userId,
      bank_name: parsedInput.bankName,
      account_holder: parsedInput.accountHolderName,
      account_number: parsedInput.accountNumber,
      iban: parsedInput.iban,
      bank_branch: parsedInput.branch ?? null,
    }); // RLS bank_own
    if (error) throw new Error(error.message);
  });

/** Section 3 · Socials. Upsert — the socials row may not exist yet. */
export const saveSocials = authActionClient
  .schema(socialAccountsSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    const userId = authUser.user?.id;
    if (!userId) throw new Error('Unauthorized');
    const { error } = await supabase.from('socials').upsert({
      employee_id: userId,
      github_url: parsedInput.github,
      linkedin_url: parsedInput.linkedin,
      twitter_url: parsedInput.twitter || null,
    }); // RLS socials_own
    if (error) throw new Error(error.message);
  });

/** Section 5 · Complete. Explicit consent activates the caller atomically:
 * `submit_onboarding()` moves onboarding → active and stamps consent/activation.
 * No admin review or notification is part of this transition. */
export const submitOnboarding = authActionClient
  .schema(consentSchema)
  .action(async ({ ctx: { supabase } }) => {
    const { error } = await supabase.rpc('submit_onboarding');
    if (error) throw new Error(error.message);
  });
