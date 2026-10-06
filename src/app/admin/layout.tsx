import { ModeToggle } from '@/components/common/mode-toggle';
import { NotetakerWidget } from '@/components/fireflies/notetaker-widget';
import { ImpersonationBanner } from '@/components/impersonation/impersonation-banner';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import { getCurrentImpersonation } from '@/lib/server/impersonation';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Set only when an admin is impersonating another admin.
  const impersonation = await getCurrentImpersonation();

  return (
    <SidebarProvider>
      <AppSidebar role='admin' impersonating={!!impersonation} />
      <SidebarInset className='min-w-0'>
        <ImpersonationBanner session={impersonation} />
        <header className='flex h-14 shrink-0 items-center gap-2 border-b border-border px-4'>
          <SidebarTrigger />
          <div className='ml-auto flex items-center gap-2'>
            <NotificationBell />
            <ModeToggle />
          </div>
        </header>
        <div className='flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6'>
          {children}
        </div>
        {/* Signed-in surfaces only — deliberately not the root layout,
            so it never appears on login or onboarding. */}
        <NotetakerWidget />
      </SidebarInset>
    </SidebarProvider>
  );
}
