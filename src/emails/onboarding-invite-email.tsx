import { Heading, Section, Text } from '@react-email/components';

import { EmailLayout } from '@/emails/components/email-layout';
import { emailStyles } from '@/emails/theme';

export type OnboardingInviteEmailProps = {
  /** Admin-authored, already-sanitized HTML with merge tokens substituted. */
  bodyHtml: string;
  appName: string;
  baseUrl: string;
  supportEmail: string;
};

/**
 * The editable invitation message inside the same branded shell as every
 * other transactional email. The body is sanitized when it is saved and its
 * merge-token values are escaped before this component receives it.
 */
export function OnboardingInviteEmail({
  bodyHtml,
  appName,
  baseUrl,
  supportEmail,
}: OnboardingInviteEmailProps) {
  return (
    <EmailLayout
      appName={appName}
      baseUrl={baseUrl}
      supportEmail={supportEmail}
      preview={`You’re invited to join ${appName}`}
    >
      <Section style={emailStyles.card}>
        <Heading style={emailStyles.heading}>You’re invited</Heading>
        <div
          style={emailStyles.paragraph}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        <Text style={emailStyles.note}>
          This invitation can only be used once.
        </Text>
      </Section>
    </EmailLayout>
  );
}

OnboardingInviteEmail.PreviewProps = {
  bodyHtml:
    '<p>Hi Ayesha Khan,</p><p>You’ve been invited to join Bitsmiths HRM. <a href="http://localhost:3000/auth/accept-invitation?token_hash=preview-token">Accept your invitation</a>.</p>',
  appName: 'Bitsmiths HRM',
  baseUrl: 'http://localhost:3000',
  supportEmail: 'support@bitsmiths.studio',
} satisfies OnboardingInviteEmailProps;

export default OnboardingInviteEmail;
