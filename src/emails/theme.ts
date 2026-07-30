import type { CSSProperties } from 'react';

/**
 * Shared brand palette + style primitives for every transactional template
 * under `src/emails`. Emails can't read CSS variables, so the brand hexes
 * (mirrors `globals.css`) live here directly. `invite-email.tsx` predates this
 * module and inlines its own copy; new templates consume these so the lifecycle
 * emails stay visually consistent.
 */
export const brand = {
  green: '#04CD77', // brand-500 — primary action / approved accent
  greenDark: '#02502E', // brand-800
  greenBg: '#ecfdf5', // tinted callout background (approved)
  amber: '#b45309', // returned / changes-requested accent
  amberBg: '#fef3c7', // tinted callout background (returned)
  blue: '#1d4ed8', // informational accent (admin submission notice)
  ink: '#1a1a1a',
  muted: '#6b7280',
  border: '#e5e7eb',
  canvas: '#f4f5f7',
  card: '#ffffff',
} as const;

export const emailStyles: Record<string, CSSProperties> = {
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
  // Definition-list style rows used in request-notification emails.
  detailRow: {
    margin: '0 0 6px',
    fontSize: '14px',
    lineHeight: '20px',
    color: '#374151',
  },
  detailLabel: {
    color: brand.muted,
    fontWeight: 600,
  },
  // Tinted callout box — reused for the approved welcome note and the
  // returned "reason" block (accent colours overridden inline per template).
  callout: {
    margin: '20px 0',
    padding: '16px 18px',
    borderRadius: '8px',
    borderLeft: `3px solid ${brand.amber}`,
    backgroundColor: brand.amberBg,
  },
  calloutLabel: {
    margin: '0 0 6px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: brand.amber,
  },
  calloutText: {
    margin: 0,
    fontSize: '15px',
    lineHeight: '23px',
    color: '#374151',
    whiteSpace: 'pre-wrap' as const,
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
