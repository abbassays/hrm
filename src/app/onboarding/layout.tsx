import Image from 'next/image';
import Link from 'next/link';

import { ModeToggle } from '@/components/common/mode-toggle';
import { ImpersonationBanner } from '@/components/impersonation/impersonation-banner';

import { getCurrentImpersonation } from '@/lib/server/impersonation';

import { appConfig } from '@/config/app';
import { paths } from '@/constants/paths';

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const impersonation = await getCurrentImpersonation();

  return (
    <div className='flex min-h-svh flex-col bg-background'>
      <ImpersonationBanner session={impersonation} />
      <header className='flex h-14 shrink-0 items-center border-b border-border px-4 md:px-6'>
        <Link href={paths.home} className='flex items-center gap-2'>
          <Image
            src={appConfig.logo}
            alt='Bitsmiths logo'
            width={20}
            height={21}
          />
          <span className='text-sm font-semibold'>{appConfig.title}</span>
        </Link>
        <div className='ml-auto'>
          <ModeToggle />
        </div>
      </header>
      <main className='mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-8'>
        {children}
      </main>
    </div>
  );
}
