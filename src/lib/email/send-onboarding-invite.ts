import 'server-only';

import { renderOnboardingEmail } from '@/lib/email/render-onboarding-email';
import { sendInviteEmail } from '@/lib/resend/send-invite-email';
import { supabaseAdmin } from '@/lib/supabase/admin';
import Logger from '@/utils/logger';

type SendOnboardingInviteInput = {
  to: string;
  /** Invitee's name for the `{{employee_name}}` token; '' when unknown. */
  employeeName: string;
  /** The `/auth/accept-invitation` URL for the `{{onboarding_link}}` token. */
  onboardingLink: string;
};

/**
 * Render the saved onboarding email and send it (M1.3 invite + resend).
 *
 * The template read uses the service-role client because RLS on
 * `onboarding_email_template` is admin-only and this runs mid-invite (the caller
 * is an admin, but reading out-of-band keeps the concern here). If the row is
 * missing/empty we log and fall through — `renderOnboardingEmail` substitutes
 * its built-in default, so an invite never fails for lack of a template. This
 * owns only the email's subject/body source; the onboarding link itself is
 * still minted by the invite action (ownership boundary, PRD).
 */
export async function sendOnboardingInvite({
  to,
  employeeName,
  onboardingLink,
}: SendOnboardingInviteInput) {
  const { data: template, error } = await supabaseAdmin
    .from('onboarding_email_template')
    .select('subject, body_html')
    .eq('id', true)
    .maybeSingle();
  if (error || !template) {
    Logger.error(
      'Onboarding email template unavailable — sending built-in default',
      error,
    );
  }

  const { subject, html } = renderOnboardingEmail(template ?? null, {
    onboardingLink,
    employeeName,
  });

  await sendInviteEmail({ to, subject, bodyHtml: html });
}
