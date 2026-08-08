import 'server-only';

import { resend } from '@/lib/resend/client';

import { appConfig } from '@/config/app';

type SendRecordingReadyEmailInput = {
  to: string;
  fullName?: string | null;
  meetingTitle: string;
  requestedBy: string;
  durationMinutes: number | null;
  appUrl: string;
};

// Seed/demo records use IANA-reserved example domains; they cannot receive mail
// and Resend rejects them before delivery. Same guard the policy emails use.
const RESERVED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.net',
  'example.org',
]);

const isReservedEmail = (email: string) =>
  RESERVED_EMAIL_DOMAINS.has(
    email.trim().split('@').at(-1)?.toLowerCase() ?? '',
  );

/**
 * Tell someone a recording they were given access to is ready.
 *
 * Deliberately links back to this app rather than to Fireflies: recipients have
 * no Fireflies seat, `transcript_url` would show them a login wall, and the
 * media URLs are CloudFront signed URLs that 403 for everyone. The transcript
 * and summary live in our database and are gated by RLS, so a forwarded email
 * grants nothing on its own.
 */
export async function sendRecordingReadyEmail({
  to,
  fullName,
  meetingTitle,
  requestedBy,
  durationMinutes,
  appUrl,
}: SendRecordingReadyEmailInput) {
  if (isReservedEmail(to)) return;

  const length =
    durationMinutes != null ? ` (${Math.round(durationMinutes)} minutes)` : '';

  const { error } = await resend.emails.send({
    from: appConfig.emails.sender,
    replyTo: appConfig.emails.support,
    to,
    subject: `Meeting notes ready: ${meetingTitle}`,
    text:
      `Hi ${fullName ?? 'there'},\n\n` +
      `The notes for "${meetingTitle}"${length} are ready. ` +
      `${requestedBy} shared this recording with you.\n\n` +
      `Open ${appUrl} and use the Notetaker widget in the bottom-right corner ` +
      `to read the summary, action items and full transcript.\n\n` +
      `You are seeing this because you were added before the meeting started.`,
  });

  if (error) throw new Error(error.message);
}
