import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

import {
  extractCorrelationToken,
  fetchTranscript,
  fetchTranscriptTitle,
} from '@/lib/fireflies/client';
import { sendRecordingReadyEmail } from '@/lib/resend/send-recording-email';
import {
  meetingCompletedMessage,
  sendSlackNotification,
} from '@/lib/slack/send-notification';
import { supabaseAdmin } from '@/lib/supabase/admin';
import Logger from '@/utils/logger';

import { appConfig } from '@/config/app';

import type { Json } from '@/types/supabase';

/**
 * Fireflies webhook receiver.
 *
 * The webhook URL is configured account-wide in Fireflies Developer Settings,
 * so EVERY meeting on the connected account arrives here — including private
 * calls this app never requested. Those must leak nothing.
 *
 * How that is guaranteed:
 *
 *   1. Signature is verified first. Unsigned or mis-signed requests never reach
 *      any Fireflies API call.
 *   2. Only the meeting TITLE is fetched. If it carries no token of ours, we
 *      stop — no transcript, no summary, no media URLs are ever requested for a
 *      meeting we did not start.
 *   3. Only then is full detail fetched and stored, and only the people named
 *      on the share list before the call get told.
 *
 * Unrecognised meetings return 200, not 404: a non-2xx makes Fireflies retry,
 * which would turn every unrelated meeting into a permanent retry loop.
 *
 * The real payload is `{ event, timestamp, meeting_id }` — snake_case, and not
 * what the public docs describe (`eventType` / `meetingId` / `clientReferenceId`).
 * Confirmed from a live test event on 2026-08-09.
 */

type FirefliesWebhookPayload = {
  event?: string;
  timestamp?: number;
  meeting_id?: string;
};

/** Timing-safe compare tolerant of unequal lengths — `timingSafeEqual` throws
 *  on a length mismatch, and that throw is itself an oracle. */
function signaturesMatch(expected: string, received: string) {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Fireflies' own connectivity ping. It carries a synthetic meeting id
 *  (`test_00000000`) that resolves to nothing, so it is acknowledged and
 *  dropped before any lookup. */
const TEST_EVENT = 'test';

export async function POST(request: Request) {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  const rawBody = await request.text();

  const receivedSignature =
    request.headers.get('x-hub-signature') ??
    request.headers.get('x-hub-signature-256') ??
    '';

  if (!secret) {
    Logger.error(
      '[fireflies] FIREFLIES_WEBHOOK_SECRET is not set — refusing to process an unverifiable webhook',
    );
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  // Verified against the RAW body: re-serialising via request.json() would
  // reorder keys or change whitespace and break an otherwise valid signature.
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const normalized = receivedSignature.replace(/^sha256=/i, '').trim();

  if (!normalized || !signaturesMatch(digest, normalized)) {
    Logger.error('[fireflies] signature rejected', {
      received: receivedSignature || '(none)',
      expected: process.env.NODE_ENV === 'production' ? '(hidden)' : digest,
      bodyBytes: rawBody.length,
    });
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: FirefliesWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as FirefliesWebhookPayload;
  } catch {
    Logger.error('[fireflies] signed payload was not valid JSON', { rawBody });
    return NextResponse.json({ ok: true, ignored: 'unparseable' });
  }

  const event = payload.event ?? '(missing)';
  const meetingId = payload.meeting_id;
  Logger.info(`[fireflies] event="${event}" meeting_id=${meetingId ?? '(none)'}`);

  if (event === TEST_EVENT || !meetingId || meetingId.startsWith('test_')) {
    return NextResponse.json({ ok: true, ignored: 'test or id-less event' });
  }

  // --- step 1: title only. Everything else is gated behind a token match. ---
  const titleResult = await fetchTranscriptTitle(meetingId);
  if (!titleResult.ok) {
    // Transient failures are worth a retry, so signal one. A meeting that is
    // genuinely ours will come back on the next delivery.
    Logger.error('[fireflies] could not read title', {
      meetingId,
      error: titleResult.error,
    });
    return NextResponse.json({ error: 'lookup failed' }, { status: 502 });
  }

  const token = extractCorrelationToken(titleResult.data.transcript?.title);
  if (!token) {
    // Not ours. This is the common path — most meetings on the account are
    // private. Nothing fetched, nothing stored, nothing logged about content.
    return NextResponse.json({ ok: true, ignored: 'not a widget meeting' });
  }

  const { data: meeting } = await supabaseAdmin
    .from('fireflies_meetings')
    .select('id, title, requested_by, status')
    .eq('correlation_token', token)
    .maybeSingle();

  if (!meeting) {
    // A token-shaped title with no matching row: treat exactly like "not ours".
    Logger.warning('[fireflies] token had no matching meeting', { token });
    return NextResponse.json({ ok: true, ignored: 'unknown token' });
  }

  // --- step 2: the bot confirming it joined. No content exists yet. ---
  if (/bot.?joined/i.test(event)) {
    await supabaseAdmin
      .from('fireflies_meetings')
      .update({
        status: 'bot_joined',
        bot_joined_at: new Date().toISOString(),
        fireflies_meeting_id: meetingId,
      })
      .eq('id', meeting.id)
      .eq('status', 'requested');
    return NextResponse.json({ ok: true, handled: 'bot_joined' });
  }

  // --- step 3: transcript or summary ready. Now content may be fetched. ---
  const detail = await fetchTranscript(meetingId);
  if (!detail.ok || !detail.data.transcript) {
    Logger.error('[fireflies] could not read transcript', {
      meetingId,
      error: detail.ok ? 'empty transcript' : detail.error,
    });
    return NextResponse.json({ error: 'transcript fetch failed' }, { status: 502 });
  }

  const t = detail.data.transcript;
  // "Transcribed" and "Summarized" both land here, in either order. The write is
  // idempotent so whichever arrives second simply refreshes the same row —
  // notably filling in the summary, which is absent on the transcribed event.
  const alreadyCompleted = meeting.status === 'completed';

  await supabaseAdmin
    .from('fireflies_meetings')
    .update({
      status: 'completed',
      fireflies_meeting_id: meetingId,
      transcript_url: t.transcript_url,
      audio_url: t.audio_url,
      video_url: t.video_url,
      duration_minutes: t.duration ?? null,
      meeting_date: t.dateString ?? null,
      summary: t.summary ?? null,
      // The only consumable form of the recording for anyone without a
      // Fireflies seat — see the type's note on why the URLs are not enough.
      transcript_sentences: (t.sentences ?? null) as Json,
      completed_at: new Date().toISOString(),
    })
    .eq('id', meeting.id);

  // Notify once. The second event refreshes data without re-pinging Slack or
  // re-emailing anyone.
  if (!alreadyCompleted) {
    const [{ data: requester }, { data: shares }] = await Promise.all([
      supabaseAdmin
        .from('employees')
        .select('full_name')
        .eq('id', meeting.requested_by)
        .maybeSingle(),
      supabaseAdmin
        .from('fireflies_meeting_shares')
        .select('employees(id, full_name, email)')
        .eq('meeting_id', meeting.id),
    ]);

    const recipients = (shares ?? [])
      .map(
        (row) =>
          row.employees as
            | { id: string; full_name: string | null; email: string }
            | null,
      )
      .filter(
        (person): person is { id: string; full_name: string | null; email: string } =>
          Boolean(person),
      );
    const sharedWith = recipients
      .map((person) => person.full_name)
      .filter((name): name is string => Boolean(name));

    // Best-effort per recipient: one bad address must not stop the others, and
    // the transcript is already saved regardless.
    const results = await Promise.allSettled(
      recipients.map((person) =>
        sendRecordingReadyEmail({
          to: person.email,
          fullName: person.full_name,
          meetingTitle: meeting.title,
          requestedBy: requester?.full_name ?? 'A colleague',
          durationMinutes: t.duration ?? null,
          appUrl: appConfig.appUrl,
        }),
      ),
    );
    results.forEach((result) => {
      if (result.status === 'rejected') {
        Logger.error('[fireflies] recording email failed', result.reason);
      }
    });

    await sendSlackNotification(
      meetingCompletedMessage({
        title: meeting.title,
        requestedBy: requester?.full_name ?? 'Someone',
        durationMinutes: t.duration ?? null,
        sharedWith,
      }),
    );
  }

  return NextResponse.json({ ok: true, handled: event });
}

/** Confirms the tunnel reaches this route without needing a signed event.
 *  Reports whether the secret is loaded, never what it is. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'fireflies-webhook',
    secretConfigured: Boolean(process.env.FIREFLIES_WEBHOOK_SECRET),
    apiKeyConfigured: Boolean(process.env.FIREFLIES_API_KEY),
  });
}
