import { ModeToggle } from '@/components/common/mode-toggle';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider>
      <AppSidebar role='admin' />
      <SidebarInset className='min-w-0'>
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
      </SidebarInset>
    </SidebarProvider>
  );
}
