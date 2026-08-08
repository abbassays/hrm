import 'server-only';

import Logger from '@/utils/logger';

/**
 * Post to a Slack incoming webhook.
 *
 * Best-effort by design and never thrown from. A Slack outage must not stop
 * someone summoning a notetaker, and must not stop a finished recording
 * reaching the people it was promised to — the same posture policy emails
 * already take. Failures are logged and dropped.
 *
 * Silently a no-op when SLACK_WEBHOOK_URL is unset, so the feature works
 * end-to-end before Slack is wired up.
 */
export async function sendSlackNotification(text: string, blocks?: unknown[]) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
      cache: 'no-store',
    });
    if (!response.ok) {
      Logger.error('[slack] webhook rejected', {
        status: response.status,
        body: await response.text(),
      });
    }
  } catch (error) {
    Logger.error('[slack] webhook failed', error);
  }
}

/** Fired when someone points the notetaker at a call. */
export function notetakerSummonedMessage(input: {
  requestedBy: string;
  title: string;
  meetingLink: string;
  sharedWith: string[];
}) {
  const recipients = input.sharedWith.length
    ? input.sharedWith.join(', ')
    : 'nobody else';
  return (
    `🎙️ *${input.requestedBy}* sent the Fireflies notetaker to a meeting\n` +
    `*${input.title}*\n` +
    `Link: ${input.meetingLink}\n` +
    `Recording will go to: ${recipients}`
  );
}

/** Fired when a meeting we requested finishes processing. */
export function meetingCompletedMessage(input: {
  title: string;
  requestedBy: string;
  durationMinutes: number | null;
  sharedWith: string[];
}) {
  const length =
    input.durationMinutes != null
      ? ` · ${Math.round(input.durationMinutes)} min`
      : '';
  const recipients = input.sharedWith.length
    ? input.sharedWith.join(', ')
    : 'nobody else';
  return (
    `✅ Meeting recording ready\n` +
    `*${input.title}*${length}\n` +
    `Requested by: ${input.requestedBy}\n` +
    `Shared with: ${recipients}`
  );
}
