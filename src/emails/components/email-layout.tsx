import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

import { brand, emailStyles } from '@/emails/theme';

export type EmailLayoutProps = {
  /** Product name, e.g. "Bitsmiths HRM". */
  appName: string;
  /** Absolute origin used to resolve the hosted logo (email clients can't load
   *  SVG/relative assets). */
  baseUrl: string;
  /** Where replies and help requests should go. */
  supportEmail: string;
  /** Inbox-preview snippet (hidden preheader text). */
  preview: string;
  /** The card(s) that make up the body of the specific email. */
  children: ReactNode;
};

/**
 * Shared chrome for the onboarding lifecycle emails: branded header, the
 * per-template body, and the support footer. Mirrors the structure of
 * `invite-email.tsx` so every transactional message reads as one system.
 */
export function EmailLayout({
  appName,
  baseUrl,
  supportEmail,
  preview,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Section style={emailStyles.header}>
            <Img
              src={`${baseUrl}/email/logo.png`}
              width='40'
              height='42'
              alt='Bitsmiths'
              style={emailStyles.logo}
            />
            <Text style={emailStyles.wordmark}>Bitsmiths</Text>
          </Section>

          {children}

          <Hr style={emailStyles.hr} />

          <Section>
            <Text style={emailStyles.footer}>
              Need a hand? Reach us at{' '}
              <Link
                href={`mailto:${supportEmail}`}
                style={emailStyles.footerLink}
              >
                {supportEmail}
              </Link>
              .
            </Text>
            <Text style={emailStyles.footerFine}>
              © {appName} · Sent by the {appName} team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Shared accent colour handle so templates don't reach into the palette. */
export { brand };
