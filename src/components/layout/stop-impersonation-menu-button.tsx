'use client';

import { UserX } from 'lucide-react';

import { useStopImpersonation } from '@/hooks/actions/use-impersonation';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function StopImpersonationMenuButton() {
  const { execute, isPending } = useStopImpersonation();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip='Stop impersonating'
          disabled={isPending}
          onClick={() => execute({})}
          className='text-primary hover:text-primary'
        >
          <UserX aria-hidden />
          <span>Stop impersonating</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
