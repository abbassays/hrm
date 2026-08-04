'use client';

import { useState } from 'react';

import { useProfilePhoto } from '@/hooks/queries/onboarding';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

import { getInitials } from '@/lib/team';

type PolicyEmployeeAvatarProps = {
  employeeId: string;
  fullName: string;
};

/** Employee identity in the policy acknowledgement roster. A private, signed
 * profile image is used when available; initials appear only when no image is
 * available or it fails to load. */
export function PolicyEmployeeAvatar({
  employeeId,
  fullName,
}: PolicyEmployeeAvatarProps) {
  const { data: photo, isError, isLoading } = useProfilePhoto(employeeId);
  const [loadedPhotoUrl, setLoadedPhotoUrl] = useState<string | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

  // Loading and image-decoding are distinct phases. Keeping a skeleton through
  // both makes initials a clear signal that this employee has no usable photo.
  if (isLoading) return <Skeleton className='size-7 shrink-0 rounded-full' />;

  const showInitials = !photo || isError || failedPhotoUrl === photo?.url;
  const isPhotoRendered = loadedPhotoUrl === photo?.url;

  return (
    <Avatar className='size-7 shrink-0'>
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
        <AvatarFallback className='bg-muted text-[11px] font-semibold text-muted-foreground'>
          {getInitials(fullName) || '—'}
        </AvatarFallback>
      ) : !isPhotoRendered ? (
        <Skeleton className='absolute inset-0 rounded-full' />
      ) : null}
    </Avatar>
  );
}
