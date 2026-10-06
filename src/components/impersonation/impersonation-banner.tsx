import { UserCog } from 'lucide-react';

import { StopImpersonationButton } from './stop-impersonation-button';

import type { ImpersonationSession } from '@/types/impersonation';

type ImpersonationBannerProps = {
  session: ImpersonationSession | null;
};

export function ImpersonationBanner({ session }: ImpersonationBannerProps) {
  if (!session) return null;

  return (
    <div
      role='status'
      className='flex min-h-12 items-center gap-3 border-b border-primary bg-primary px-4 py-2 text-sm text-primary-foreground'
    >
      <UserCog className='size-4 shrink-0' aria-hidden />
      <p className='min-w-0 flex-1 truncate'>
        Viewing as <span className='font-semibold'>{session.targetName}</span>.
      </p>
      <StopImpersonationButton />
    </div>
  );
}
