'use client';

import { useState } from 'react';

import { useProfilePhoto } from '@/hooks/queries/onboarding';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

import { getInitials } from '@/lib/team';
import { cn } from '@/lib/utils';

/**
 * Employee identity anywhere a person is shown — directory rows, the approvals
 * queue, payroll, the policy roster, the notetaker widget.
 *
 * Profile photos live in the private `identity-docs` bucket, so each one is a
 * short-lived signed URL fetched per employee and cached by `useProfilePhoto`.
 * Initials are a genuine state, not just a loading placeholder: admins and
 * anyone who never completed onboarding have no photo at all.
 *
 * Loading and image-decoding are treated as distinct phases. Holding a skeleton
 * through both is what keeps initials meaningful — they appear only when there
 * is really no usable photo, rather than flashing on every render.
 */

const SIZES = {
  sm: 'size-6 text-[10px]',
  md: 'size-7 text-[11px]',
  lg: 'size-9 text-xs',
} as const;

type EmployeeAvatarProps = {
  employeeId: string;
  fullName: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function EmployeeAvatar({
  employeeId,
  fullName,
  size = 'md',
  className,
}: EmployeeAvatarProps) {
  const { data: photo, isError, isLoading } = useProfilePhoto(employeeId);
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState<string | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

  const sizeClass = SIZES[size];

  if (isLoading) {
    return (
      <Skeleton className={cn('shrink-0 rounded-full', sizeClass, className)} />
    );
  }

  const showInitials = !photo || isError || failedPhotoUrl === photo?.url;
  const isPhotoRendered = loadedPhotoUrl === photo?.url;

  return (
    <Avatar className={cn('shrink-0', sizeClass, className)}>
      {photo && !isError && (
        <AvatarImage
          src={photo.url}
          alt={`${fullName} profile photo`}
          className='object-cover'
          onLoadingStatusChange={(status) => {
            if (status === 'loaded') setLoadedPhotoUrl(photo.url);
            if (status === 'error') setFailedPhotoUrl(photo.url);
          }}
        />
      )}
      {showInitials ? (
        <AvatarFallback className='bg-muted font-semibold text-muted-foreground'>
          {getInitials(fullName) || '—'}
        </AvatarFallback>
      ) : !isPhotoRendered ? (
        <Skeleton className='absolute inset-0 rounded-full' />
      ) : null}
    </Avatar>
  );
}
