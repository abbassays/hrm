import { useQuery } from '@tanstack/react-query';

import { authQuery } from '@/lib/client/auth-query';

import { QueryKeys } from '@/constants/query-keys';

export type NotetakerMeeting = {
  id: string;
  title: string;
  meetingLink: string;
  language: string;
  status: 'requested' | 'bot_joined' | 'completed' | 'failed';
  failureReason: string | null;
  transcriptUrl: string | null;
  summary: Record<string, unknown> | null;
  sentences: { speaker_name: string | null; text: string | null }[] | null;
  durationMinutes: number | null;
  meetingDate: string | null;
  createdAt: string;
  requestedById: string;
  requestedByName: string | null;
  sharedWith: { id: string; fullName: string | null }[];
};

/**
 * Meetings the signed-in employee may see: ones they summoned, plus ones they
 * were put on the share list for. That split is enforced by RLS
 * (`fireflies_meetings_select_own_or_shared`), not here — this query simply
 * asks for everything and the database returns only what is permitted.
 */
const fetchMeetings = authQuery(async ({ supabase }) => {
  const { data, error } = await supabase
    .from('fireflies_meetings')
    .select(
      `id, title, meeting_link, language, status, failure_reason,
       transcript_url, summary, transcript_sentences, duration_minutes,
       meeting_date, created_at, requested_by,
       requester:employees!fireflies_meetings_requested_by_fkey ( full_name ),
       fireflies_meeting_shares ( employees ( id, full_name ) )`,
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row): NotetakerMeeting => {
    const shares = (row.fireflies_meeting_shares ?? []) as {
      employees: { id: string; full_name: string | null } | null;
    }[];
    return {
      id: row.id,
      title: row.title,
      meetingLink: row.meeting_link,
      language: row.language,
      status: row.status,
      failureReason: row.failure_reason,
      transcriptUrl: row.transcript_url,
      summary: (row.summary as Record<string, unknown> | null) ?? null,
      sentences:
        (row.transcript_sentences as
          | { speaker_name: string | null; text: string | null }[]
          | null) ?? null,
      durationMinutes: row.duration_minutes,
      meetingDate: row.meeting_date,
      createdAt: row.created_at,
      requestedById: row.requested_by,
      requestedByName:
        (row.requester as { full_name: string | null } | null)?.full_name ??
        null,
      sharedWith: shares
        .map((share) => share.employees)
        .filter((employee): employee is { id: string; full_name: string | null } =>
          Boolean(employee),
        )
        .map((employee) => ({ id: employee.id, fullName: employee.full_name })),
    };
  });
});

/** History for the notetaker widget. Polls while anything is still in flight so
 *  a bot joining or a transcript landing appears without a manual refresh. */
export const useNotetakerMeetings = () =>
  useQuery({
    queryKey: [QueryKeys.NOTETAKER_MEETINGS],
    queryFn: () => fetchMeetings(),
    refetchInterval: (query) => {
      const rows = query.state.data;
      const pending = rows?.some(
        (meeting) =>
          meeting.status === 'requested' || meeting.status === 'bot_joined',
      );
      return pending ? 20_000 : false;
    },
  });
