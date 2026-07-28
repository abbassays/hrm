'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { usePendingApprovals } from '@/hooks/queries/pending-approvals';
import { useUnacknowledgedPolicyCount } from '@/hooks/queries/policies';
import { useSystemConfig } from '@/hooks/queries/system-config';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

import { appConfig } from '@/config/app';
import { adminNav, employeeNav } from '@/constants/hrm-nav';
import { paths } from '@/constants/paths';

import { SignOutButton } from './sign-out-button';
import { UserCard } from './user-card';

type AppSidebarProps = {
  /** Nav config resolves client-side — icon components can't cross the
   *  server→client boundary as props. */
  role: 'employee' | 'admin';
};

const exactMatchHrefs: string[] = [
  paths.employee.dashboard,
  paths.admin.dashboard,
];

export function AppSidebar({ role }: AppSidebarProps) {
  const config = role === 'admin' ? adminNav : employeeNav;
  const pathname = usePathname();
  const unacknowledgedPolicies = useUnacknowledgedPolicyCount();
  const pendingApprovals = usePendingApprovals(role === 'admin');
  const { data: systemConfig } = useSystemConfig();

  // Feature-flagged entries (e.g. Reimbursements) stay hidden until their
  // `system_config` toggle is on. Config is unknown while the query loads, so
  // gated items default to hidden — matching "Phase 2 stays dark".
  const items = config.items.filter(
    (item) => !item.requiresFlag || !!systemConfig?.[item.requiresFlag],
  );

  const isActive = (href: string) =>
    exactMatchHrefs.includes(href)
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  /** Static badges come from the nav config; the employee Policies item
   *  gets a live "needs acknowledgment" count instead. */
  const badgeFor = (item: { href: string; badge?: number }) =>
    role === 'employee' && item.href === paths.employee.policies
      ? unacknowledgedPolicies || undefined
      : role === 'admin' && item.href === paths.admin.approvals
        ? pendingApprovals.data?.length || undefined
        : item.badge;

  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader className='px-3 py-3 group-data-[collapsible=icon]:px-2'>
        <Link href={paths.home} className='flex items-center gap-2'>
          <Image
            src={appConfig.logo}
            alt='Bitsmiths logo'
            width={20}
            height={21}
            className='shrink-0'
          />
          <span className='text-sm font-semibold group-data-[collapsible=icon]:hidden'>
            {appConfig.title}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{config.roleLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!badgeFor(item) && (
                    <SidebarMenuBadge className='rounded-full bg-primary px-1.5 text-primary-foreground'>
                      {badgeFor(item)}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserCard />
        <SignOutButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
