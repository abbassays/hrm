import { z } from 'zod';

import { PendingApproval } from '@/types/hrm';

/**
 * Runtime shape of one `pending_approvals()` row — the parse boundary for the
 * admin queue.
 *
 * The generated RPC type can't stand in for this, even freshly regenerated:
 * `kind` is a bare `text` column, so the generator widens it to `string` and
 * loses the three-value union, and `amount` is typed non-null even though the
 * leave and overtime branches of the union both select `null::int`
 * (see 20260720130000_m4_pending_approvals.sql). Parsing is what actually makes
 * `PendingApproval` true of the data rather than merely asserted.
 *
 * `employee_name` is nullable at the source — `employees.full_name` has no NOT
 * NULL constraint and admin accounts carry null names today — so it is
 * coalesced to '' rather than rejected, matching how every other query mapper
 * in `hooks/queries/*` handles a missing name. Rejecting would turn a cosmetic
 * gap into a queue-wide failure.
 */
export const pendingApprovalSchema = z.object({
  kind: z.enum(['leave', 'medical', 'overtime']),
  item_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  employee_name: z
    .string()
    .nullable()
    .transform((value) => value ?? ''),
  summary: z.string(),
  amount: z.number().nullable(),
  submitted_at: z.string(),
}) satisfies z.ZodType<PendingApproval, z.ZodTypeDef, unknown>;

export const pendingApprovalsSchema = z.array(pendingApprovalSchema);
