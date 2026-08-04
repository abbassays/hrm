'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useUploadIdentityDoc } from '@/hooks/mutations/use-upload-identity-doc';
import { useIdentityDocFiles } from '@/hooks/queries/onboarding';

import { FileUpload } from '@/components/hrm/file-upload';
import { ProfilePhotoCropDialog } from '@/components/profile/profile-photo-crop-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { getInitials } from '@/lib/team';

const PROFILE_PHOTO_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

type ProfilePhotoCardProps = {
  employeeId: string;
  fullName: string;
};

/** Lets an employee replace the photo used in their sidebar. This deliberately
 * reuses the onboarding `photo` object, keeping one secure source of truth for
 * their identity photo rather than introducing a second storage location. */
export function ProfilePhotoCard({
  employeeId,
  fullName,
}: ProfilePhotoCardProps) {
  const { data: identityFiles, isLoading } = useIdentityDocFiles(employeeId);
  const upload = useUploadIdentityDoc(employeeId);
  const [isUploading, setIsUploading] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState<File | null>(null);
  const [photoToCropUrl, setPhotoToCropUrl] = useState<string | null>(null);

  const photo = identityFiles?.photo;
  const photoUrl = photo?.mimeType.startsWith('image/') ? photo.url : undefined;

  useEffect(
    () => () => {
      if (photoToCropUrl) URL.revokeObjectURL(photoToCropUrl);
    },
    [photoToCropUrl],
  );

  const selectPhoto = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setPhotoToCrop(file);
    setPhotoToCropUrl(URL.createObjectURL(file));
  };

  const closeCropper = () => {
    setPhotoToCrop(null);
    setPhotoToCropUrl(null);
  };

  const uploadPhoto = (file: File) => {
    closeCropper();

    setIsUploading(true);
    upload.mutate(
      { docType: 'photo', file },
      {
        onSuccess: () => toast.success('Profile photo updated'),
        onSettled: () => setIsUploading(false),
      },
    );
  };

  return (
    <>
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-lg font-medium'>Profile Photo</CardTitle>
          <CardDescription>
            This photo appears beside your name in the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-5 sm:flex-row sm:items-center'>
          <Avatar className='aspect-square size-20 shrink-0'>
            {photoUrl && (
              <AvatarImage
                src={photoUrl}
                alt={`${fullName} profile photo`}
                className='object-cover'
              />
            )}
            <AvatarFallback className='bg-primary text-lg font-semibold text-primary-foreground'>
              {fullName ? getInitials(fullName) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className='flex-1'>
            {isLoading ? (
              <div className='h-10 w-36 animate-pulse rounded-md bg-muted' />
            ) : (
              <FileUpload
                value={[]}
                onChange={selectPhoto}
                maxFiles={1}
                maxSizeMb={5}
                accept='image/png,image/jpeg'
                allowedMimeTypes={PROFILE_PHOTO_MIME_TYPES}
                hint='PNG or JPG image · up to 5MB'
                label={photoUrl ? 'Replace photo' : 'Upload photo'}
                isLoading={isUploading}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {photoToCrop && photoToCropUrl && (
        <ProfilePhotoCropDialog
          file={photoToCrop}
          imageUrl={photoToCropUrl}
          onCancel={closeCropper}
          onConfirm={uploadPhoto}
        />
      )}
    </>
  );
}
