import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { CSSProperties } from 'react';

export type InviteEmailProps = {
  /** Full name of the invitee, when known. */
  fullName?: string | null;
  /** One-time link that lands on `/auth/accept-invitation`. */
  inviteUrl: string;
  /** Product name, e.g. "Bitsmiths HRM". */
  appName: string;
  /** Absolute origin used to resolve the hosted logo (email clients can't load SVG/relative assets). */
  baseUrl: string;
  /** Where replies and help requests should go. */
  supportEmail: string;
};

// Bitsmiths brand palette (mirrors globals.css). Emails can't read CSS
// variables, so the brand hexes live here directly.
const brand = {
  green: '#04CD77', // brand-500 — primary action
  greenDark: '#02502E', // brand-800
  ink: '#1a1a1a',
  muted: '#6b7280',
  border: '#e5e7eb',
  canvas: '#f4f5f7',
  card: '#ffffff',
};

export function InviteEmail({
  fullName,
  inviteUrl,
  appName,
  baseUrl,
  supportEmail,
}: InviteEmailProps) {
  const greeting = fullName ? `Hi ${fullName},` : 'Hi,';

  return (
    <Html>
      <Head />
      <Preview>{`You've been invited to join ${appName}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={`${baseUrl}/email/logo.png`}
              width='40'
              height='42'
              alt='Bitsmiths'
              style={styles.logo}
            />
            <Text style={styles.wordmark}>Bitsmiths</Text>
          </Section>

          <Section style={styles.card}>
            <Heading style={styles.heading}>You&apos;re invited</Heading>
            <Text style={styles.paragraph}>{greeting}</Text>
            <Text style={styles.paragraph}>
              You&apos;ve been invited to join <strong>{appName}</strong>. Click
              the button below to set your password and get started.
            </Text>

            <Section style={styles.buttonWrap}>
              <Button href={inviteUrl} style={styles.button}>
                Accept invitation
              </Button>
            </Section>

            <Text style={styles.note}>
              For your security, this invitation will expire and can only be
              used once.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Section>
            <Text style={styles.footer}>
              Didn&apos;t expect this invite? You can safely ignore this email.
              Need a hand? Reach us at{' '}
              <Link href={`mailto:${supportEmail}`} style={styles.footerLink}>
                {supportEmail}
              </Link>
              .
            </Text>
            <Text style={styles.footerFine}>
              © {appName} · Sent by the {appName} team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Sample data the React Email preview server (`pnpm email`) renders with.
InviteEmail.PreviewProps = {
  fullName: 'Ayesha Khan',
  inviteUrl:
    'http://localhost:3000/auth/accept-invitation?token_hash=preview-token',
  appName: 'Bitsmiths HRM',
  baseUrl: 'http://localhost:3000',
  supportEmail: 'support@bitsmiths.studio',
} satisfies InviteEmailProps;

export default InviteEmail;

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: brand.canvas,
    margin: 0,
    padding: '32px 0',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: brand.ink,
  },
  container: {
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    padding: '0 24px',
  },
  header: {
    padding: '4px 0 20px',
    textAlign: 'center' as const,
  },
  logo: {
    display: 'inline-block',
    verticalAlign: 'middle',
  },
  wordmark: {
    display: 'inline-block',
    verticalAlign: 'middle',
    margin: '0 0 0 10px',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: brand.ink,
  },
  card: {
    backgroundColor: brand.card,
    border: `1px solid ${brand.border}`,
    borderRadius: '12px',
    borderTop: `3px solid ${brand.green}`,
    padding: '32px',
  },
  heading: {
    margin: '0 0 16px',
    fontSize: '22px',
    fontWeight: 700,
    lineHeight: '28px',
    color: brand.ink,
  },
  paragraph: {
    margin: '0 0 16px',
    fontSize: '15px',
    lineHeight: '24px',
    color: '#374151',
  },
  buttonWrap: {
    margin: '28px 0 8px',
    textAlign: 'center' as const,
  },
  button: {
    backgroundColor: brand.green,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
    borderRadius: '8px',
    padding: '13px 28px',
    display: 'inline-block',
  },
  note: {
    margin: '20px 0 0',
    fontSize: '13px',
    lineHeight: '20px',
    color: brand.muted,
    textAlign: 'center' as const,
  },
  hr: {
    borderColor: brand.border,
    margin: '24px 0',
  },
  footer: {
    margin: '0 0 8px',
    fontSize: '13px',
    lineHeight: '20px',
    color: brand.muted,
    textAlign: 'center' as const,
  },
  footerLink: {
    color: brand.greenDark,
    textDecoration: 'underline',
  },
  footerFine: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '18px',
    color: '#9ca3af',
    textAlign: 'center' as const,
  },
};
