import { Button, Heading, Section, Text } from '@react-email/components';

import { EmailLayout } from '@/emails/components/email-layout';
import { emailStyles } from '@/emails/theme';

export type PolicyUpdatedEmailProps = {
  fullName?: string | null;
  policyTitle: string;
  policyUrl: string;
  appName: string;
  baseUrl: string;
  supportEmail: string;
};

/** Sent after an admin publishes a new version of an existing policy. It
 * intentionally does not describe or compare the changes. */
export function PolicyUpdatedEmail({
  fullName,
  policyTitle,
  policyUrl,
  appName,
  baseUrl,
  supportEmail,
}: PolicyUpdatedEmailProps) {
  return (
    <EmailLayout
      appName={appName}
      baseUrl={baseUrl}
      supportEmail={supportEmail}
      preview={`${policyTitle} has been updated`}
    >
      <Section style={emailStyles.card}>
        <Heading style={emailStyles.heading}>Policy updated</Heading>
        <Text style={emailStyles.paragraph}>
          {fullName ? `Hi ${fullName},` : 'Hi,'}
        </Text>
        <Text style={emailStyles.paragraph}>
          <strong>{policyTitle}</strong> has been updated. Please review the
          latest document and acknowledge it.
        </Text>
        <Section style={emailStyles.buttonWrap}>
          <Button href={policyUrl} style={emailStyles.button}>
            View policy
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
}

PolicyUpdatedEmail.PreviewProps = {
  fullName: 'Ayesha Khan',
  policyTitle: 'Leave Policy',
  policyUrl: 'http://localhost:3000/policies/example-policy-id',
  appName: 'Bitsmiths HRM',
  baseUrl: 'http://localhost:3000',
  supportEmail: 'support@bitsmiths.studio',
} satisfies PolicyUpdatedEmailProps;

export default PolicyUpdatedEmail;
