'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useMarkAllRead,
  useMarkNotificationRead,
} from '@/hooks/actions/use-mark-notification-read';
import {
  useNotifications,
  useUnreadCount,
} from '@/hooks/queries/notifications';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { Notification } from '@/types/hrm';

/** Badges beyond 9 collapse to "9+" so the count never widens the bell. */
const formatBadge = (count: number) => (count > 9 ? '9+' : String(count));

/**
 * The shared employee/admin notification bell. Shows an unread-count badge and
 * a dropdown feed (newest first); clicking a notification navigates to its
 * `link` and marks it read, and "Mark all as read" clears the caller's count.
 *
 * The unread count comes from its own `head` count query (accurate even past the
 * 50-row feed cap); the per-row unread dot comes from each row's `readAt`.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const openNotification = (notification: Notification) => {
    if (!notification.readAt) {
      markRead.execute({ id: notification.id });
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='relative'
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className='size-5' />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className='absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground'
            >
              {formatBadge(unreadCount)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-96 p-0'>
        <Tabs defaultValue='unread' className='h-full'>
          <div className='flex items-center justify-between gap-2 border-b border-border px-3 py-2'>
            <TabsList>
              <TabsTrigger value='unread'>Unread</TabsTrigger>
              <TabsTrigger value='read'>Read</TabsTrigger>
            </TabsList>
            <Button
              variant='ghost'
              size='sm'
              className='h-8 px-2 text-xs'
              onClick={() => markAllRead.execute({})}
              disabled={unreadCount === 0}
              isLoading={markAllRead.isPending}
            >
              Mark all as read
            </Button>
          </div>

          <div className='h-80 overflow-hidden p-3'>
            {isLoading ? (
              <div className='flex h-full items-center justify-center'>
                <Skeleton className='h-12 w-full rounded-md' />
              </div>
            ) : !notifications?.length ? (
              <p className='px-3 py-8 text-center text-sm text-muted-foreground'>
                No notifications yet.
              </p>
            ) : (
              <>
                <TabsContent value='unread' className='h-full overflow-hidden'>
                  <div className='flex h-full flex-col gap-3 overflow-y-auto pb-2 pr-2'>
                    {notifications
                      .filter((notification) => !notification.readAt)
                      .map((notification) => (
                        <article
                          key={notification.id}
                          role={notification.link ? 'link' : undefined}
                          tabIndex={notification.link ? 0 : undefined}
                          className={
                            notification.link
                              ? 'w-full cursor-pointer rounded-xl border border-border bg-background p-4 shadow-sm transition-colors hover:bg-muted/50'
                              : 'w-full rounded-xl border border-border bg-background p-4 shadow-sm'
                          }
                          onClick={() => openNotification(notification)}
                          onKeyDown={(event) => {
                            if (
                              notification.link &&
                              (event.key === 'Enter' || event.key === ' ')
                            ) {
                              event.preventDefault();
                              openNotification(notification);
                            }
                          }}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div className='flex flex-col gap-1'>
                              <p className='text-sm font-semibold'>
                                {notification.title}
                              </p>
                              {notification.body && (
                                <p className='line-clamp-3 text-xs text-muted-foreground'>
                                  {notification.body}
                                </p>
                              )}
                            </div>
                            <Button
                              variant='link'
                              size='sm'
                              className='h-auto p-0 text-xs'
                              onClick={(event) => {
                                event.stopPropagation();
                                markRead.execute({ id: notification.id });
                              }}
                              disabled={!!notification.readAt}
                            >
                              Mark as read
                            </Button>
                          </div>
                          <p className='mt-4 text-xs text-muted-foreground'>
                            {formatDistanceToNow(
                              new Date(notification.createdAt),
                              {
                                addSuffix: true,
                              },
                            )}
                          </p>
                        </article>
                      ))}
                    {!notifications.some(
                      (notification) => !notification.readAt,
                    ) && (
                      <p className='text-sm text-muted-foreground'>
                        No unread notifications.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value='read' className='h-full overflow-hidden'>
                  <div className='flex h-full flex-col gap-3 overflow-y-auto pb-2 pr-2'>
                    {notifications
                      .filter((notification) => !!notification.readAt)
                      .map((notification) => (
                        <article
                          key={notification.id}
                          role={notification.link ? 'link' : undefined}
                          tabIndex={notification.link ? 0 : undefined}
                          className={
                            notification.link
                              ? 'w-full cursor-pointer rounded-xl border border-border bg-background p-4 shadow-sm transition-colors hover:bg-muted/50'
                              : 'w-full rounded-xl border border-border bg-background p-4 shadow-sm'
                          }
                          onClick={() => openNotification(notification)}
                          onKeyDown={(event) => {
                            if (
                              notification.link &&
                              (event.key === 'Enter' || event.key === ' ')
                            ) {
                              event.preventDefault();
                              openNotification(notification);
                            }
                          }}
                        >
                          <p className='text-sm font-semibold'>
                            {notification.title}
                          </p>
                          {notification.body && (
                            <p className='mt-2 line-clamp-3 text-xs text-muted-foreground'>
                              {notification.body}
                            </p>
                          )}
                          <p className='mt-4 text-xs text-muted-foreground'>
                            {formatDistanceToNow(
                              new Date(notification.createdAt),
                              {
                                addSuffix: true,
                              },
                            )}
                          </p>
                        </article>
                      ))}
                    {!notifications.some(
                      (notification) => !!notification.readAt,
                    ) && (
                      <p className='text-sm text-muted-foreground'>
                        No read notifications.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
