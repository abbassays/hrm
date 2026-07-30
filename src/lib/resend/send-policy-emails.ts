import 'server-only';

import { resend } from '@/lib/resend/client';

import { appConfig } from '@/config/app';
import { PolicyUpdatedEmail } from '@/emails/policy-updated-email';

type SendPolicyUpdatedEmailInput = {
  to: string;
  fullName?: string | null;
  policyTitle: string;
  policyUrl: string;
};

// Seed/demo employee records use IANA-reserved example domains. They cannot
// receive mail, and Resend's test environment rejects them before delivery.
const RESERVED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
]);

const isReservedEmail = (email: string) =>
  RESERVED_EMAIL_DOMAINS.has(
    email.trim().split('@').at(-1)?.toLowerCase() ?? '',
  );

/** Sends a concise policy-update email. Change details deliberately remain in
 * the policy document itself rather than being repeated in email. */
export async function sendPolicyUpdatedEmail({
  to,
  fullName,
  policyTitle,
  policyUrl,
}: SendPolicyUpdatedEmailInput) {
  if (isReservedEmail(to)) return;

  const { error } = await resend.emails.send({
    from: appConfig.emails.sender,
    replyTo: appConfig.emails.support,
    to,
    subject: `${policyTitle} has been updated`,
    react: PolicyUpdatedEmail({
      fullName,
      policyTitle,
      policyUrl,
      appName: appConfig.appName,
      baseUrl: appConfig.appUrl,
      supportEmail: appConfig.emails.support,
    }),
  });

  if (error) throw new Error(error.message);
}
