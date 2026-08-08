'use client';

import { format } from 'date-fns';
import { Check, ChevronLeft, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useSummonNotetaker } from '@/hooks/actions/use-summon-notetaker';
import { useCurrentEmployee, useEmployees } from '@/hooks/queries/employees';
import {
  type NotetakerMeeting,
  useNotetakerMeetings,
} from '@/hooks/queries/fireflies';

import { EmployeeAvatar } from '@/components/hrm/employee-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

import { FIREFLIES_LANGUAGES } from '@/schema/fireflies';

/**
 * Floating notetaker widget, mounted on every signed-in surface.
 *
 * Three views inside one panel: summon, history, and a single recording. The
 * recording view renders the stored transcript and summary rather than linking
 * out — employees have no Fireflies seat, and the media URLs are CloudFront
 * signed URLs that 403 for everyone.
 */

const STATUS: Record<
  NotetakerMeeting['status'],
  { label: string; className: string }
> = {
  completed: { label: 'READY', className: 'bg-primary/15 text-primary' },
  bot_joined: { label: 'RECORDING', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  requested: { label: 'REQUESTED', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'FAILED', className: 'bg-destructive/15 text-destructive' },
};

export function NotetakerWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);

  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'en' | 'ur'>('en');
  const [shareWith, setShareWith] = useState<string[]>([]);

  const { data: meetings, isLoading } = useNotetakerMeetings();
  const { data: employees } = useEmployees();
  const { data: me } = useCurrentEmployee();

  const summon = useSummonNotetaker(() => {
    toast.success('Notetaker is joining the meeting');
    setLink('');
    setTitle('');
    setShareWith([]);
    setTab('history');
  });

  const recording = useMemo(
    () => meetings?.some((meeting) => meeting.status === 'bot_joined') ?? false,
    [meetings],
  );
  const openMeeting = meetings?.find((meeting) => meeting.id === openMeetingId);

  // Everyone but the requester — they are added server-side regardless, so
  // offering them as a toggle would imply they could be left out.
  const selectable = (employees ?? []).filter(
    (employee) => employee.id !== me?.id && employee.status === 'active',
  );

  const toggle = (id: string) =>
    setShareWith((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  const canSubmit = link.trim().length > 0 && title.trim().length > 0;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Fireflies notetaker"
          className="fixed bottom-6 right-6 z-50 inline-flex h-[52px] items-center gap-[9px] rounded-full bg-primary pl-4 pr-[18px] text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/40 transition-transform hover:-translate-y-px"
        >
          <span className="relative grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-white shadow-sm">
            <Image
              src="/fireflies-logo.png"
              alt=""
              width={21}
              height={21}
              className="size-[21px]"
            />
            {recording && (
              <span className="absolute -right-0.5 -top-0.5 size-[9px] animate-pulse rounded-full border-2 border-primary bg-amber-500" />
            )}
          </span>
          Notetaker
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex max-h-[min(640px,calc(100vh-90px))] w-[396px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl max-[760px]:inset-x-2.5 max-[760px]:bottom-2.5 max-[760px]:w-auto">
          <div className="flex items-center gap-2.5 border-b border-border p-3.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-white shadow-sm">
              <Image src="/fireflies-logo.png" alt="" width={22} height={22} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">Fireflies Notetaker</p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {tab === 'new'
                  ? 'Send the bot to a live call'
                  : 'Meetings you started or were shared'}
              </p>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='ml-auto size-8'
              onClick={() => {
                setOpen(false);
                setOpenMeetingId(null);
              }}
              aria-label='Close'
            >
              <X aria-hidden />
            </Button>
          </div>

          <div className="flex gap-0.5 border-b border-border px-2.5 pt-2">
            {(['new', 'history'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setOpenMeetingId(null);
                }}
                className={cn(
                  '-mb-px border-b-2 px-3 pb-2.5 pt-1.5 text-[13px] font-medium',
                  tab === value
                    ? 'border-primary font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground',
                )}
              >
                {value === 'new' ? 'New meeting' : 'History'}
                {value === 'history' && meetings?.length ? (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">
                    {meetings.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5">
            {tab === 'new' && (
              <div className="flex flex-col gap-3.5">
                <div>
                  <label htmlFor="ff-link" className="mb-1.5 block text-xs font-semibold">
                    Meeting link
                  </label>
                  <Input
                    id="ff-link"
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    placeholder="https://meet.google.com/…"
                  />
                </div>

                <div>
                  <label htmlFor="ff-title" className="mb-1.5 block text-xs font-semibold">
                    Meeting title
                  </label>
                  <Input
                    id="ff-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Motornomic — sprint review"
                  />
                </div>

                <div>
                  <label htmlFor="ff-lang" className="mb-1.5 block text-xs font-semibold">
                    Language
                  </label>
                  <select
                    id="ff-lang"
                    value={language}
                    onChange={(event) =>
                      setLanguage(event.target.value as 'en' | 'ur')
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {FIREFLIES_LANGUAGES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold">
                    Share the recording with
                  </p>
                  <div className="overflow-hidden rounded-md border border-input">
                    <div className="max-h-[152px] overflow-y-auto">
                      <div className="flex items-center gap-2.5 px-2.5 py-2 opacity-60">
                        <EmployeeAvatar
                          employeeId={me?.id ?? ''}
                          fullName={me?.full_name ?? 'You'}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">
                            {me?.full_name ?? 'You'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Always included
                          </p>
                        </div>
                        <span className="ml-auto grid size-[17px] place-items-center rounded bg-muted-foreground text-card">
                          <Check className="size-3" aria-hidden />
                        </span>
                      </div>
                      {selectable.map((employee) => {
                        const picked = shareWith.includes(employee.id);
                        return (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() => toggle(employee.id)}
                            className="flex w-full items-center gap-2.5 border-t border-border px-2.5 py-2 text-left hover:bg-muted"
                          >
                            <EmployeeAvatar
                              employeeId={employee.id}
                              fullName={employee.fullName}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium">
                                {employee.fullName}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {employee.email}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'ml-auto grid size-[17px] shrink-0 place-items-center rounded border-[1.5px]',
                                picked
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-input',
                              )}
                            >
                              {picked && <Check className="size-3" aria-hidden />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    Chosen now, before the call. Nobody can be added afterwards —
                    this is the only thing that grants access.
                  </p>
                </div>

                <Button
                  disabled={!canSubmit}
                  isLoading={summon.isPending}
                  onClick={() =>
                    summon.execute({
                      meetingLink: link.trim(),
                      title: title.trim(),
                      language,
                      shareWith,
                    })
                  }
                >
                  Send notetaker
                </Button>
              </div>
            )}

            {tab === 'history' && !openMeeting && (
              <>
                {isLoading ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-20 rounded-md" />
                    <Skeleton className="h-20 rounded-md" />
                  </div>
                ) : !meetings?.length ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-semibold">No meetings yet</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      Send the notetaker to a call and the recording shows up
                      here once it finishes.
                    </p>
                  </div>
                ) : (
                  meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() =>
                        meeting.status === 'completed' &&
                        setOpenMeetingId(meeting.id)
                      }
                      className="mb-2 block w-full rounded-md border border-border p-3 text-left hover:border-primary/50"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold">
                            {meeting.title}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                            {format(new Date(meeting.createdAt), 'MMM d, HH:mm')}
                            {meeting.status === 'failed' && meeting.failureReason
                              ? ` · ${meeting.failureReason}`
                              : meeting.durationMinutes
                                ? ` · ${Math.round(meeting.durationMinutes)} min`
                                : ''}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                            STATUS[meeting.status].className,
                          )}
                        >
                          {STATUS[meeting.status].label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center">
                        {meeting.sharedWith.slice(0, 4).map((person) => (
                          <EmployeeAvatar
                            key={person.id}
                            employeeId={person.id}
                            fullName={person.fullName ?? ''}
                            size="sm"
                            className="-mr-1.5 border-2 border-card"
                          />
                        ))}
                        <span className="ml-3 text-[11px] text-muted-foreground">
                          {meeting.sharedWith.length} with access
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </>
            )}

            {openMeeting && (
              <div>
                <button
                  type="button"
                  onClick={() => setOpenMeetingId(null)}
                  className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-3.5" aria-hidden /> Back to history
                </button>
                <p className="text-[15px] font-bold">{openMeeting.title}</p>
                <p className="mb-3 mt-0.5 text-[11.5px] text-muted-foreground">
                  {openMeeting.meetingDate
                    ? format(new Date(openMeeting.meetingDate), 'MMM d, HH:mm')
                    : format(new Date(openMeeting.createdAt), 'MMM d, HH:mm')}
                  {openMeeting.durationMinutes
                    ? ` · ${Math.round(openMeeting.durationMinutes)} min`
                    : ''}
                  {openMeeting.requestedByName
                    ? ` · by ${openMeeting.requestedByName}`
                    : ''}
                </p>

                {typeof openMeeting.summary?.overview === 'string' && (
                  <>
                    <p className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Summary
                    </p>
                    <div className="rounded-md border border-border bg-muted/60 p-3 text-[12.5px]">
                      {openMeeting.summary.overview as string}
                    </div>
                  </>
                )}

                {Array.isArray(openMeeting.summary?.action_items) && (
                  <>
                    <p className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Action items
                    </p>
                    <ul className="list-disc rounded-md border border-border bg-muted/60 p-3 pl-7 text-[12.5px]">
                      {(openMeeting.summary.action_items as string[]).map(
                        (item, index) => (
                          <li key={index} className="mb-1">
                            {item}
                          </li>
                        ),
                      )}
                    </ul>
                  </>
                )}

                {openMeeting.sentences?.length ? (
                  <>
                    <p className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Transcript
                    </p>
                    <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-muted/60 p-3 text-[12.5px]">
                      {openMeeting.sentences.map((line, index) => (
                        <p key={index} className="mb-1.5">
                          <span className="font-semibold">
                            {line.speaker_name ?? 'Speaker'}:
                          </span>{' '}
                          {line.text}
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Transcript is still processing.
                  </p>
                )}

                <p className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Shared with
                </p>
                <div className="flex flex-col gap-1.5">
                  {openMeeting.sharedWith.map((person) => (
                    <div key={person.id} className="flex items-center gap-2.5">
                      <EmployeeAvatar
                        employeeId={person.id}
                        fullName={person.fullName ?? ''}
                      />
                      <p className="text-[13px] font-medium">{person.fullName}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
