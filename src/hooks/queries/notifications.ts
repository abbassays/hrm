import { useQuery } from '@tanstack/react-query';

import { authQuery } from '@/lib/client/auth-query';

import { QueryKeys } from '@/constants/query-keys';

import { Notification } from '@/types/hrm';

/** RLS (`notif_select_own`) returns only the caller's own rows, so neither of
 *  these queries filters by recipient — the row-level policy is the boundary. */
const NOTIFICATION_COLUMNS = 'id, type, title, body, link, read_at, created_at';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const toNotification = (row: NotificationRow) =>
  ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }) satisfies Notification;

/** The caller's feed, newest first. Capped at 50 — the bell is a recent-events
 *  view, not an archive. */
const fetchNotifications = authQuery(
  async ({ supabase, user }): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select(NOTIFICATION_COLUMNS)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return data.map(toNotification);
  },
);

/** Just the unread count for the badge — a `head` count, so no rows travel. */
const fetchUnreadCount = authQuery(
  async ({ supabase, user }): Promise<number> => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (error) throw new Error(error.message);

    return count ?? 0;
  },
);

/** Poll interval for the bell. The shell (and therefore the bell) persists
 *  across in-app navigation, so it won't refetch on route changes; a modest
 *  interval plus the default window-focus refetch keeps the badge fresh without
 *  a realtime subscription (BIT-26 marks realtime optional for MVP). */
const NOTIFICATION_REFETCH_MS = 60_000;

/** The bell's dropdown feed. */
export const useNotifications = () =>
  useQuery({
    queryKey: [QueryKeys.NOTIFICATIONS],
    queryFn: () => fetchNotifications(),
    refetchInterval: NOTIFICATION_REFETCH_MS,
  });

/** The bell's unread badge. Kept a separate query so the count stays cheap and
 *  can be invalidated on its own after mark-read. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: [QueryKeys.NOTIFICATIONS_UNREAD],
    queryFn: () => fetchUnreadCount(),
    refetchInterval: NOTIFICATION_REFETCH_MS,
  });
