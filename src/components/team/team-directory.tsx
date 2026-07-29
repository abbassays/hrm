'use client';

import { Github, Mail } from 'lucide-react';

import { useCurrentEmployee, useEmployees } from '@/hooks/queries/employees';

import { CopyButton } from '@/components/hrm/copy-button';
import { EmptyState } from '@/components/hrm/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { getInitials, githubHandle } from '@/lib/team';

import { EmployeeListItem } from '@/types/hrm';

export function TeamDirectory() {
  const { data: employees, isLoading } = useEmployees();
  const { data: currentEmployee } = useCurrentEmployee();

  if (isLoading) {
    return (
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-40 rounded-xl' />
        ))}
      </div>
    );
  }

  // Everyone who has joined the company — exclude still-pending invites,
  // whose profiles are mostly empty until they onboard.
  const members = (employees ?? []).filter(
    (employee) => employee.status !== 'invited',
  );

  if (!members.length) {
    return (
      <EmptyState
        icon={Mail}
        title='No colleagues yet'
        description='Team members appear here once they’ve joined and completed onboarding.'
      />
    );
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
      {members.map((member) => (
        <TeamMemberCard
          key={member.id}
          member={member}
          currentEmployee={currentEmployee}
        />
      ))}
    </div>
  );
}

function TeamMemberCard({ member, currentEmployee }: { member: EmployeeListItem; currentEmployee?: { id: string } | null }) {
  const isYou = currentEmployee?.id === member.id;
  const github = member.social?.github;

  return (
    <Card>
      <CardContent className='flex flex-col gap-4 p-5'>
        <div className='flex items-center gap-3'>
          <Avatar className='size-11'>
            <AvatarFallback className='text-sm font-medium'>
              {getInitials(member.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className='flex min-w-0 flex-col'>
            <div className='flex items-center gap-2'>
              <span className='truncate font-medium'>{member.fullName}</span>
              {isYou && (
                <Badge variant='secondary' className='shrink-0'>
                  You
                </Badge>
              )}
            </div>
            <span className='truncate text-xs text-muted-foreground'>
              {member.designation || 'Designation not set'}
            </span>
          </div>
        </div>

        <div className='flex flex-col gap-1'>
          <ContactRow icon={Mail} copyValue={member.email} copyLabel='email'>
            <a
              href={`mailto:${member.email}`}
              className='truncate hover:text-foreground hover:underline'
            >
              {member.email}
            </a>
          </ContactRow>

          {github ? (
            <ContactRow
              icon={Github}
              copyValue={github}
              copyLabel='GitHub profile'
            >
              <a
                href={github}
                target='_blank'
                rel='noreferrer'
                className='truncate hover:text-foreground hover:underline'
              >
                {githubHandle(github)}
              </a>
            </ContactRow>
          ) : (
            <div className='flex items-center gap-2 py-1 pl-1 text-sm text-muted-foreground/60'>
              <Github className='size-4 shrink-0' aria-hidden />
              <span className='italic'>No GitHub added</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ContactRow({
  icon: Icon,
  copyValue,
  copyLabel,
  children,
}: {
  icon: typeof Mail;
  copyValue: string;
  copyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex items-center gap-2 rounded-md pl-1 text-sm text-muted-foreground'>
      <Icon className='size-4 shrink-0' aria-hidden />
      <div className='min-w-0 flex-1'>{children}</div>
      <CopyButton value={copyValue} label={copyLabel} />
    </div>
  );
}
