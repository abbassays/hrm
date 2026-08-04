'use client';

import { User } from 'lucide-react';

import { useCurrentEmployee } from '@/hooks/queries/employees';
import { useIdentityDocFiles } from '@/hooks/queries/onboarding';
import { useUser } from '@/hooks/queries/user';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

import { getInitials } from '@/lib/team';

/** Sidebar identity for the signed-in user. Purely informational — it replaced
 *  the dev-only role switcher, so there is no way to cross into the other
 *  role's app from here (real auth + the middleware role funnel decide that). */
export function UserCard() {
  const { data: employee, isLoading } = useCurrentEmployee();
  const { data: authUser } = useUser();
  const { data: identityFiles } = useIdentityDocFiles(employee?.id ?? '');

  const isAdmin = employee?.role === 'admin';
  const authName =
    typeof authUser?.user_metadata.full_name === 'string'
      ? authUser.user_metadata.full_name.trim()
      : '';
  // Older admin records can lack `employees.full_name`, while their invitation
  // still supplied the name to Supabase Auth metadata. Prefer either name before
  // falling back to an email address.
  const name =
    employee?.full_name?.trim() ||
    authName ||
    employee?.email ||
    authUser?.email ||
    '';
  const photo = identityFiles?.photo;
  const photoUrl = photo?.mimeType.startsWith('image/') ? photo.url : undefined;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className='flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:p-0'>
          <Avatar className='size-8 shrink-0'>
            {photoUrl && (
              <AvatarImage
                src={photoUrl}
                alt={`${name || 'User'} profile photo`}
                className='object-cover'
              />
            )}
            <AvatarFallback className='bg-primary text-xs font-semibold text-primary-foreground'>
              {name ? (
                getInitials(name)
              ) : (
                <User className='size-4' aria-hidden />
              )}
            </AvatarFallback>
          </Avatar>
          <div className='grid flex-1 leading-tight group-data-[collapsible=icon]:hidden'>
            {isLoading ? (
              <>
                <Skeleton className='h-3.5 w-24' />
                <Skeleton className='mt-1.5 h-3 w-16' />
              </>
            ) : (
              <>
                <span className='truncate text-sm font-medium'>{name}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  {isAdmin ? 'Administrator' : 'Employee'}
                </span>
              </>
            )}
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
