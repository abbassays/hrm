-- Fireflies notetaker: summon a bot to a live call, then deliver the recording
-- only to people chosen BEFORE the call started.
--
-- The access model is the whole point. Fireflies runs on a single personal
-- account, and its webhook URL is account-wide, so every meeting on that
-- account — including private client calls that never touched this app —
-- reaches our endpoint. Nothing may leak from those.
--
-- Two things enforce that:
--
--   1. `correlation_token` is a random string stamped into the meeting title we
--      send to Fireflies. On a webhook we read back only the title, extract the
--      token and look it up here. No token, no row, no further API calls and
--      nothing stored. A meeting we did not start is indistinguishable from
--      noise, by construction. `addToLive` returns only `{ success }` and the
--      `clientReferenceId` webhook field is settable solely on the upload-audio
--      endpoint, so this is the only correlation available.
--
--   2. The share list is written when the meeting is requested and RLS reads
--      from it. Access is decided up front and never widens afterwards.
--
-- Deliberately NO admin override on select. Admins can already read payslips
-- and medical claims; letting them read every recording would defeat the point,
-- since the account owner's private meetings are the sensitive ones here.

create type public.fireflies_meeting_status as enum (
  'requested',   -- addToLive accepted; bot has not confirmed yet
  'bot_joined',  -- bot confirmed in the call
  'completed',   -- transcript stored and shared
  'failed'       -- addToLive rejected (rate limit, bad link)
);

create table public.fireflies_meetings (
  id                    uuid primary key default gen_random_uuid(),
  requested_by          uuid not null references public.employees(id) on delete cascade,
  meeting_link          text not null,
  title                 text not null,
  language              text not null default 'en',
  -- Unguessable, unique, and the only link between a webhook and this row.
  correlation_token     text not null unique,
  status                public.fireflies_meeting_status not null default 'requested',
  failure_reason        text,
  -- Everything below is filled in by the webhook.
  fireflies_meeting_id  text unique,
  transcript_url        text,
  video_url             text,
  audio_url             text,
  summary               jsonb,
  duration_minutes      numeric(6,2),
  meeting_date          timestamptz,
  bot_joined_at         timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint fireflies_meetings_language_check
    check (language in ('en', 'ur')),
  constraint fireflies_meetings_link_check
    check (meeting_link ~* '^https?://'),
  constraint fireflies_meetings_title_check
    check (char_length(btrim(title)) between 1 and 200)
);

create index fireflies_meetings_requested_by_idx
  on public.fireflies_meetings (requested_by, created_at desc);
create index fireflies_meetings_token_idx
  on public.fireflies_meetings (correlation_token);

create trigger trg_fireflies_meetings_updated
before update on public.fireflies_meetings
for each row execute function public.set_updated_at();

-- Who the recording goes to. Written at request time, alongside the meeting.
create table public.fireflies_meeting_shares (
  meeting_id  uuid not null references public.fireflies_meetings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (meeting_id, employee_id)
);

create index fireflies_meeting_shares_employee_idx
  on public.fireflies_meeting_shares (employee_id);

alter table public.fireflies_meetings enable row level security;
alter table public.fireflies_meeting_shares enable row level security;

-- Readable by the person who summoned the bot, or anyone on the share list.
-- SECURITY DEFINER so the meetings policy can consult shares without the
-- shares policy recursing back into meetings.
create or replace function public.can_read_fireflies_meeting(p_meeting uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fireflies_meetings m
     where m.id = p_meeting
       and (
         m.requested_by = auth.uid()
         or exists (
           select 1 from public.fireflies_meeting_shares s
            where s.meeting_id = m.id and s.employee_id = auth.uid()
         )
       )
  )
$$;

revoke execute on function public.can_read_fireflies_meeting(uuid) from public, anon;
grant execute on function public.can_read_fireflies_meeting(uuid) to authenticated;

create policy fireflies_meetings_select_own_or_shared
on public.fireflies_meetings
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.fireflies_meeting_shares s
     where s.meeting_id = id and s.employee_id = auth.uid()
  )
);

-- You may only ever create a meeting as yourself. The webhook updates rows
-- through the service role, so no update policy is granted to end users:
-- transcript fields are not theirs to write.
create policy fireflies_meetings_insert_self
on public.fireflies_meetings
for insert
to authenticated
with check (requested_by = auth.uid());

create policy fireflies_shares_select_visible
on public.fireflies_meeting_shares
for select
to authenticated
using (public.can_read_fireflies_meeting(meeting_id));

-- Shares are only writable by the requester, and only for a meeting they own.
create policy fireflies_shares_insert_by_requester
on public.fireflies_meeting_shares
for insert
to authenticated
with check (
  exists (
    select 1 from public.fireflies_meetings m
     where m.id = meeting_id and m.requested_by = auth.uid()
  )
);

comment on table public.fireflies_meetings is
  'Notetaker requests. `correlation_token` is stamped into the Fireflies meeting '
  'title and is the only way a webhook is matched back to a row — meetings '
  'without a known token are ignored entirely.';
comment on column public.fireflies_meetings.summary is
  'Fireflies AI summary object (overview, action items, keywords) as returned.';

-- Added after validating the live API: employees have no Fireflies seat, and
-- `transcript_url` needs a login while `audio_url`/`video_url` are CloudFront
-- signed URLs the API never gives us a signature for (they 403 with
-- "MissingKey" even with the API key). Storing the sentences is what actually
-- makes a recording readable inside this app.
alter table public.fireflies_meetings
  add column if not exists transcript_sentences jsonb;
