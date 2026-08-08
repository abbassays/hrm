import 'server-only';

import Logger from '@/utils/logger';

import type { Json } from '@/types/supabase';

/**
 * Minimal Fireflies GraphQL client.
 *
 * One company API key (the account owner's personal key), so every request is
 * made as that account. Two consequences worth knowing:
 *
 *   - The `addToLive` rate limit of 3 requests per 20 minutes is shared by
 *     everyone using the widget, not per user.
 *   - Every meeting the bot joins belongs to that account, which is why the
 *     account-wide webhook fires for meetings this app never requested.
 */

const ENDPOINT = 'https://api.fireflies.ai/graphql';

/** Stamped into the meeting title so a webhook can be matched back to a row.
 *  Deliberately short and visually inert — it shows up in the Fireflies UI. */
const TOKEN_PREFIX = 'bsm';

export type FirefliesResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; rateLimited?: boolean };

function apiKey() {
  return process.env.FIREFLIES_API_KEY ?? '';
}

/** `crypto.randomUUID()` without the dashes, trimmed. Unguessable is the point:
 *  a token is what proves a completed meeting is one of ours. */
export function generateCorrelationToken() {
  return `${TOKEN_PREFIX}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** The title Fireflies receives. The token has to survive round-tripping, so it
 *  is appended in brackets rather than woven into the user's own words. */
export function buildMeetingTitle(userTitle: string, token: string) {
  // Fireflies caps title at 256 chars; leave room for the token suffix.
  const suffix = ` [${token}]`;
  const room = 256 - suffix.length;
  return `${userTitle.trim().slice(0, room)}${suffix}`;
}

/** Pull our token back out of a title Fireflies handed us. */
export function extractCorrelationToken(title: string | null | undefined) {
  if (!title) return null;
  const match = title.match(/\[(bsm_[a-f0-9]{12})\]/i);
  return match ? match[1].toLowerCase() : null;
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<FirefliesResult<T>> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: 'Fireflies is not configured (missing API key).' };
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
  } catch (error) {
    Logger.error('[fireflies] network error', error);
    return { ok: false, error: 'Could not reach Fireflies.' };
  }

  const text = await response.text();
  let body: { data?: T; errors?: { message?: string; code?: string }[] };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    Logger.error('[fireflies] non-JSON response', { status: response.status, text });
    return { ok: false, error: 'Fireflies returned an unreadable response.' };
  }

  if (body.errors?.length) {
    const first = body.errors[0];
    const message = first?.message ?? 'Fireflies rejected the request.';
    // The documented shape is `too_many_requests`; match loosely so a wording
    // change still surfaces as a rate limit rather than a generic failure.
    const rateLimited =
      response.status === 429 ||
      /too_many_requests|rate.?limit/i.test(`${first?.code ?? ''} ${message}`);
    Logger.error('[fireflies] api error', { status: response.status, errors: body.errors });
    return { ok: false, error: message, rateLimited };
  }

  if (!body.data) {
    return { ok: false, error: 'Fireflies returned no data.' };
  }
  return { ok: true, data: body.data };
}

/**
 * Send the notetaker into a live call.
 *
 * `duration` is capped by Fireflies at 15–120 minutes and defaults to 60. The
 * mutation returns only `{ success }` — no meeting id — which is precisely why
 * the title carries a correlation token.
 */
export async function addToLiveMeeting(input: {
  meetingLink: string;
  title: string;
  language: string;
}) {
  return graphql<{ addToLiveMeeting: { success: boolean } }>(
    `mutation AddToLive($meetingLink: String!, $title: String, $language: String) {
       addToLiveMeeting(meeting_link: $meetingLink, title: $title, language: $language) {
         success
       }
     }`,
    {
      meetingLink: input.meetingLink,
      title: input.title,
      language: input.language,
    },
  );
}

/**
 * Fetch ONLY the title for a meeting.
 *
 * This is the first call made for any incoming webhook, including meetings this
 * app never requested. Keeping it to a single field means an unrelated private
 * call never has its transcript, summary or media pulled into our server — we
 * learn the title, find no token, and stop.
 */
export async function fetchTranscriptTitle(meetingId: string) {
  return graphql<{ transcript: { title: string | null } | null }>(
    `query TranscriptTitle($id: String!) { transcript(id: $id) { title } }`,
    { id: meetingId },
  );
}

export type FirefliesTranscript = {
  id: string;
  title: string | null;
  transcript_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  duration: number | null;
  dateString: string | null;
  /** Stored verbatim in a `jsonb` column, so it is typed as the database's own
   *  Json rather than a Record — the shape is Fireflies', not ours to model. */
  summary: Json | null;
  /** The transcript itself. Fetched and stored because it is the only form of
   *  the recording an employee can actually consume: `transcript_url` opens a
   *  Fireflies page that needs a seat, and `audio_url` / `video_url` are
   *  CloudFront signed URLs that 403 for everyone, including us with the API
   *  key ("MissingKey: Missing Key-Pair-Id"). Verified against the live API. */
  sentences: { speaker_name: string | null; text: string | null; start_time: number | null }[] | null;
};

/** Full detail, fetched only after a title has already matched one of our
 *  tokens. Never called for meetings we did not request. */
export async function fetchTranscript(meetingId: string) {
  return graphql<{ transcript: FirefliesTranscript | null }>(
    `query Transcript($id: String!) {
       transcript(id: $id) {
         id
         title
         transcript_url
         audio_url
         video_url
         duration
         dateString
         summary {
           overview
           short_summary
           action_items
           keywords
           outline
           bullet_gist
         }
         sentences {
           speaker_name
           text
           start_time
         }
       }
     }`,
    { id: meetingId },
  );
}
