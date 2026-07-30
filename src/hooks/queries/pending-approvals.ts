import { useQuery } from '@tanstack/react-query';

import { authQuery } from '@/lib/client/auth-query';

import { QueryKeys } from '@/constants/query-keys';
import { pendingApprovalsSchema } from '@/schema/pending-approval';

import { PendingApproval } from '@/types/hrm';

// Admin: every pending item across leave/medical/overtime in one
// guarded round-trip, oldest first. The RPC is security definer + asserts
// is_admin() itself (RLS is bypassed), so a non-admin gets a 42501 rather than a
// partial read — the /admin route guard keeps them off the page in the first
// place. This is the queue's source of truth for membership and order; the page
// enriches the open row's detail sheet from the per-module admin reads.
const fetchPendingApprovals = authQuery(
  async ({ supabase }): Promise<PendingApproval[]> => {
    const { data, error } = await supabase.rpc('pending_approvals');
    if (error) throw new Error(error.message);
    // Parsed, not cast: the generated RPC type mis-reports `kind` (widened to
    // string) and `amount` (typed non-null), so only this validates the shape.
    return pendingApprovalsSchema.parse(data ?? []);
  },
);

/** Admin: the guarded, union-normalized pending queue across all three sources.
 *  The optional guard lets shared shell components mount the hook without
 *  calling the admin-only RPC for employees. */
export const usePendingApprovals = (enabled = true) =>
  useQuery({
    queryKey: [QueryKeys.PENDING_APPROVALS],
    queryFn: () => fetchPendingApprovals(),
    enabled,
    refetchInterval: 60_000,
  });
