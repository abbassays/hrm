'use server';

import {
  addToLiveMeeting,
  buildMeetingTitle,
  generateCorrelationToken,
} from '@/lib/fireflies/client';
import { authActionClient } from '@/lib/server/safe-action';
import {
  notetakerSummonedMessage,
  sendSlackNotification,
} from '@/lib/slack/send-notification';
import Logger from '@/utils/logger';

import { RATE_LIMIT_MESSAGE, summonNotetakerSchema } from '@/schema/fireflies';

/**
 * Send the Fireflies notetaker into a live call.
 *
 * Order matters here. The row and its share list are written BEFORE Fireflies
 * is called, because the correlation token has to exist in our database before
 * a webhook could possibly reference it — the bot can join and the meeting can
 * end faster than a slow API round-trip returns.
 *
 * If `addToLive` then fails, the row is marked `failed` rather than deleted:
 * a rate-limited attempt is worth seeing in history, and deleting would orphan
 * the token if the request actually did land.
 *
 * Available to every signed-in employee, not just admins. Access to the
 * resulting recording is governed entirely by the share list chosen here.
 */
export const summonNotetaker = authActionClient
  .schema(summonNotetakerSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    const employeeId = authUser.user?.id;
    if (!employeeId) throw new Error('Unauthorized');

    const token = generateCorrelationToken();

    const { data: meeting, error } = await supabase
      .from('fireflies_meetings')
      .insert({
        requested_by: employeeId,
        meeting_link: parsedInput.meetingLink,
        title: parsedInput.title,
        language: parsedInput.language,
        correlation_token: token,
        status: 'requested',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    // Never silently drop the requester from their own recording.
    const recipients = Array.from(
      new Set([...parsedInput.shareWith, employeeId]),
    );
    if (recipients.length) {
      const { error: shareError } = await supabase
        .from('fireflies_meeting_shares')
        .insert(
          recipients.map((id) => ({ meeting_id: meeting.id, employee_id: id })),
        );
      if (shareError) throw new Error(shareError.message);
    }

    const result = await addToLiveMeeting({
      meetingLink: parsedInput.meetingLink,
      title: buildMeetingTitle(parsedInput.title, token),
      language: parsedInput.language,
    });

    if (!result.ok || !result.data.addToLiveMeeting?.success) {
      const reason = result.ok
        ? 'Fireflies declined to join the meeting.'
        : result.rateLimited
          ? RATE_LIMIT_MESSAGE
          : result.error;

      await supabase
        .from('fireflies_meetings')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', meeting.id);

      throw new Error(reason);
    }

    // Best-effort: a Slack outage must not fail a summon the bot already
    // accepted. Mirrors how policy update emails behave.
    try {
      const { data: people } = await supabase
        .from('employees')
        .select('id, full_name')
        .in('id', recipients);

      const names = (people ?? [])
        .filter((person) => person.id !== employeeId)
        .map((person) => person.full_name)
        .filter((name): name is string => Boolean(name));

      await sendSlackNotification(
        notetakerSummonedMessage({
          requestedBy:
            (people ?? []).find((person) => person.id === employeeId)
              ?.full_name ?? 'Someone',
          title: parsedInput.title,
          meetingLink: parsedInput.meetingLink,
          sharedWith: names,
        }),
      );
    } catch (slackError) {
      Logger.error('[fireflies] summon Slack notice failed', slackError);
    }

    return { id: meeting.id };
  });
