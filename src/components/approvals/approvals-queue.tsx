'use client';

import { CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  useAllLeaveRequests,
  useAllMedicalClaims,
  useAllOvertimeLogs,
} from '@/hooks/queries/approvals';
import { usePendingApprovals } from '@/hooks/queries/pending-approvals';

import { DetailSheet } from '@/components/hrm/detail-sheet';
import { EmployeeAvatar } from '@/components/hrm/employee-avatar';
import { EmptyState } from '@/components/hrm/empty-state';
import { StatusBadge } from '@/components/hrm/status-badge';
import { ProofFilesList } from '@/components/medical/proof-files-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  type ApprovalItem,
  type ApprovalKind,
  approvalKindLabels,
  fallbackToItem,
  leaveToItem,
  medicalToItem,
  overtimeToItem,
} from './approval-items';
import { LeaveReviewActions } from './leave-review-actions';
import { MedicalReviewActions } from './medical-review-actions';
import { OvertimeReviewActions } from './overtime-review-actions';

import { type PendingApproval } from '@/types/hrm';

export function ApprovalsQueue() {
  // `pending_approvals()` is the queue's source of truth: it decides membership
  // and order (newest first), guarded server-side. The per-module admin reads
  // below only enrich the open row's detail sheet with the rich per-kind fields
  // (reasons, dates, proof files) the normalized RPC row doesn't carry.
  const pending = usePendingApprovals();
  const leave = useAllLeaveRequests();
  const medical = useAllMedicalClaims();
  const overtime = useAllOvertimeLogs();

  const [tab, setTab] = useState<'all' | ApprovalKind>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Index each source by id so a queue row can be enriched to its full detail.
  const details = useMemo(() => {
    return {
      leave: new Map((leave.data ?? []).map((r) => [r.id, r])),
      medical: new Map((medical.data ?? []).map((c) => [c.id, c])),
      overtime: new Map((overtime.data ?? []).map((o) => [o.id, o])),
    };
  }, [leave.data, medical.data, overtime.data]);

  const enrich = useMemo(() => {
    return (row: PendingApproval): ApprovalItem => {
      switch (row.kind) {
        case 'leave': {
          const r = details.leave.get(row.item_id);
          return r ? leaveToItem(r) : fallbackToItem(row);
        }
        case 'medical': {
          const c = details.medical.get(row.item_id);
          return c ? medicalToItem(c) : fallbackToItem(row);
        }
        case 'overtime': {
          const o = details.overtime.get(row.item_id);
          return o ? overtimeToItem(o) : fallbackToItem(row);
        }
      }
    };
  }, [details]);

  // Preserve the RPC's order (newest first); enrichment only fills in detail.
  const items = useMemo(
    () => (pending.data ?? []).map(enrich),
    [pending.data, enrich],
  );

  const visible =
    tab === 'all' ? items : items.filter((item) => item.kind === tab);

  // Re-derived each render so the actioned row's sheet closes on its own once the
  // invalidated queue drops it — no stale snapshot to reconcile.
  const selected = items.find((item) => item.id === selectedId) ?? null;

  if (pending.isPending) {
    return (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-9 w-72 rounded-lg' />
        <Skeleton className='h-64 rounded-xl' />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value='all'>All ({items.length})</TabsTrigger>
          {(Object.keys(approvalKindLabels) as ApprovalKind[]).map((kind) => (
            <TabsTrigger key={kind} value={kind}>
              {approvalKindLabels[kind]} (
              {items.filter((i) => i.kind === kind).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title='Queue is clear'
          description='Nothing waiting for your approval in this category.'
        />
      ) : (
        <ul className='flex flex-col divide-y divide-border rounded-lg border border-border'>
          {visible.map((item) => (
            <li
              key={item.id}
              className='flex flex-wrap items-center justify-between gap-3 px-4 py-3'
            >
              <EmployeeAvatar
                employeeId={item.employeeId}
                fullName={item.employeeName}
              />
              <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <div className='flex items-center gap-2'>
                  <p className='truncate text-sm font-medium'>
                    {item.employeeName}
                    <span className='text-muted-foreground'>
                      {' '}
                      · {item.title}
                    </span>
                  </p>
                  <Badge variant='outline' className='shrink-0'>
                    {approvalKindLabels[item.kind]}
                  </Badge>
                </div>
                <p className='truncate text-xs text-muted-foreground'>
                  {item.summary}
                </p>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setSelectedId(item.id)}
              >
                Review
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!!selected && (
        <DetailSheet
          open={!!selected}
          onOpenChange={(open) => !open && setSelectedId(null)}
          title={selected.title}
          description={`Requested by ${selected.employeeName}`}
          fields={[
            ...selected.fields,
            {
              label: 'Status',
              value: <StatusBadge status={selected.status} />,
            },
          ]}
          footer={
            selected.kind === 'leave' ? (
              // Leave is backed by the real reviewLeaveRequest action (required
              // reason on reject + employee email); its invalidation refreshes
              // the queue.
              <LeaveReviewActions
                itemId={selected.id}
                employeeName={selected.employeeName}
                onReviewed={() => setSelectedId(null)}
              />
            ) : selected.kind === 'medical' ? (
              // Medical is backed by the real reviewMedicalClaim action
              // (server-side balance bound on approve, required reason + email
              // on reject); its invalidation refreshes the queue.
              <MedicalReviewActions
                itemId={selected.id}
                employeeName={selected.employeeName}
                onReviewed={() => setSelectedId(null)}
              />
            ) : (
              // Overtime is backed by the real reviewOvertimeLog action (required
              // reason on reject + employee email); its invalidation refreshes
              // the queue.
              <OvertimeReviewActions
                itemId={selected.id}
                employeeName={selected.employeeName}
                onReviewed={() => setSelectedId(null)}
              />
            )
          }
        >
          {selected.kind === 'medical' && (
            <div className='flex flex-col gap-2'>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                Proof files
              </p>
              <ProofFilesList files={selected.proofFiles ?? []} />
            </div>
          )}
        </DetailSheet>
      )}
    </div>
  );
}
