import 'server-only';

import { resend } from '@/lib/resend/client';

import { appConfig } from '@/config/app';
import { OnboardingInviteEmail } from '@/emails/onboarding-invite-email';

type SendInviteEmailInput = {
  to: string;
  /** Fully rendered subject line (tokens already substituted). */
  subject: string;
  /** Fully rendered, sanitized HTML body (tokens already substituted). */
  bodyHtml: string;
};

/**
 * Sends the invite email through Resend. Supabase's own mailer only supports
 * the implicit-hash link flow; sending it ourselves lets the link point at
 * `/auth/accept-invitation` with a `token_hash` (see `inviteEmployee`).
 *
 * The subject and body come from the admin-editable onboarding template,
 * already rendered by `sendOnboardingInvite` (BIT-24) — this function only
 * hands the finished HTML to Resend.
 */
export async function sendInviteEmail({
  to,
  subject,
  bodyHtml,
}: SendInviteEmailInput) {
  const { error } = await resend.emails.send({
    from: appConfig.emails.sender,
    replyTo: appConfig.emails.support,
    to,
    subject,
    react: OnboardingInviteEmail({
      bodyHtml,
      appName: appConfig.appName,
      baseUrl: appConfig.appUrl,
      supportEmail: appConfig.emails.support,
    }),
  });

  if (error) {
    throw new Error(error.message);
  }
}
