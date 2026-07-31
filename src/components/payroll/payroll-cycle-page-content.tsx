'use client';

import { format } from 'date-fns';
import { ArrowLeft, Calculator, CalendarX2, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAddPayslipCustomField } from '@/hooks/actions/use-add-payslip-custom-field';
import { useCalculatePayroll } from '@/hooks/actions/use-calculate-payroll';
import { useCreateRun } from '@/hooks/actions/use-create-run';
import { useLockPayroll } from '@/hooks/actions/use-lock-payroll';
import { useOverrideDaysWorked } from '@/hooks/actions/use-override-days-worked';
import { useOverrideOtHours } from '@/hooks/actions/use-override-ot-hours';
import { useOverrideOtMultiplier } from '@/hooks/actions/use-override-ot-multiplier';
import { useRemovePayslipCustomField } from '@/hooks/actions/use-remove-payslip-custom-field';
import { useSendRunInvoices } from '@/hooks/actions/use-send-run-invoices';
import { useUnlockPayroll } from '@/hooks/actions/use-unlock-payroll';
import { useRunByMonth, useRunPayslips } from '@/hooks/queries/payroll';

import { ConfirmDialog } from '@/components/hrm/confirm-dialog';
import { EmptyState } from '@/components/hrm/empty-state';
import { PageHeader } from '@/components/hrm/page-header';
import { StatusBadge } from '@/components/hrm/status-badge';
import { BulkAdjustmentDialog } from '@/components/payroll/bulk-adjustment-dialog';
import { BulkOtRatePopover } from '@/components/payroll/bulk-ot-rate-popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCurrency } from '@/utils/number-functions';

import { paths } from '@/constants/paths';
import { payslipLineItemCopy } from '@/constants/payroll-line-items';

import { CurrentCycleTable } from './current-cycle-table';
import { ExportArtifacts } from './export-artifacts';
import { ExportPayoneerSheet } from './export-payoneer-sheet';

type PayrollCyclePageContentProps = {
  month: string; // 'YYYY-MM'
};

export function PayrollCyclePageContent({
  month,
}: PayrollCyclePageContentProps) {
  const { data: run, isLoading: runLoading } = useRunByMonth(month);
  const { data: rows, isLoading: rowsLoading } = useRunPayslips(run?.id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const calc = useCalculatePayroll();
  // Finalizing no longer emails anyone — that's the separate "Send
  // notifications" step below — so this just confirms the run is locked.
  const lock = useLockPayroll(() => toast.success('Run finalized'));
  const unlock = useUnlockPayroll(() => toast.success('Run reopened'));
  // The notification fan-out is best-effort server-side (a bounce never fails
  // the batch), so the toast reports what actually went out rather than just
  // claiming success.
  const sendAll = useSendRunInvoices(({ sent, failed }) => {
    if (failed > 0) {
      toast.warning(
        `${sent} payslip(s) emailed, ${failed} failed. Retry those from the row's send button.`,
      );
      return;
    }
    toast.success(
      sent > 0
        ? `${sent} payslip${sent === 1 ? '' : 's'} emailed`
        : 'No payslips to send',
    );
  });
  const create = useCreateRun();
  const overrideDays = useOverrideDaysWorked();
  const overrideMult = useOverrideOtMultiplier();
  const overrideOtHours = useOverrideOtHours();
  // Both writes are silent otherwise: the dialog stays open and the row's total
  // only moves once the recalc lands, so nothing confirms the edit stuck. This
  // one serves the per-row dialogs only (the bulk dialog runs its own action, so
  // it can close itself), hence the single-employee wording — the sign the two
  // columns split on is what names the item.
  const addField = useAddPayslipCustomField(({ label, amount }) => {
    const { noun } = payslipLineItemCopy[amount > 0 ? 'earning' : 'deduction'];
    toast.success(`${noun} "${label}" added`);
  });
  // The remove action takes an index, not the item — there's no label to quote
  // back, hence the neutral wording.
  const removeField = useRemovePayslipCustomField(() =>
    toast.success('Line item removed'),
  );

  const monthLabel = format(`${month}-01`, 'MMMM yyyy');
  const locked = run?.status === 'locked';
  const busy =
    calc.isPending ||
    lock.isPending ||
    unlock.isPending ||
    sendAll.isPending ||
    overrideDays.isPending ||
    overrideMult.isPending ||
    overrideOtHours.isPending ||
    addField.isPending ||
    removeField.isPending;
  const gridRows = rows ?? [];
  const draftTotal = gridRows.reduce((sum, row) => sum + row.totalPay, 0);
  const totalPayroll = locked ? (run?.totalPayroll ?? 0) : draftTotal;

  const exportRows = gridRows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    total: row.totalPay,
  }));

  const toggleRow = (payslipId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(payslipId)) next.delete(payslipId);
      else next.add(payslipId);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.size === gridRows.length
        ? new Set()
        : new Set(gridRows.map((row) => row.id)),
    );

  const handleBulkOtRate = (multiplier: number) => {
    if (!run || selectedIds.size === 0) return;
    overrideMult.execute({
      run_id: run.id,
      payslip_ids: [...selectedIds],
      overtime_multiplier: multiplier,
    });
  };

  return (
    <>
      <div>
        <Link href={paths.admin.payroll}>
          <Button variant='ghost' size='sm' iconLeft={ArrowLeft}>
            Back to Payroll
          </Button>
        </Link>
      </div>

      {runLoading ? (
        <Skeleton className='h-48 rounded-xl' />
      ) : !run ? (
        <EmptyState
          icon={CalendarX2}
          title={`No payroll run for ${monthLabel}`}
          description='Create the run to generate its draft payslips.'
        >
          <Button
            isLoading={create.isPending}
            onClick={() => create.execute({ period_month: `${month}-01` })}
          >
            Create {monthLabel} run
          </Button>
        </EmptyState>
      ) : (
        <>
          <PageHeader
            title={monthLabel}
            description='Review this run, lock it, then export for Payoneer.'
          >
            <StatusBadge status={run.status} />
          </PageHeader>

          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex flex-wrap items-center gap-2'>
              {selectedIds.size > 0 && !locked && (
                <>
                  <span className='text-sm text-muted-foreground'>
                    {selectedIds.size} selected
                  </span>
                  <BulkOtRatePopover
                    selectedCount={selectedIds.size}
                    onApply={handleBulkOtRate}
                  />
                  <BulkAdjustmentDialog
                    runId={run.id}
                    payslipIds={[...selectedIds]}
                    kind='earning'
                  />
                  <BulkAdjustmentDialog
                    runId={run.id}
                    payslipIds={[...selectedIds]}
                    kind='deduction'
                  />
                </>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              {locked && (
                <ConfirmDialog
                  trigger={
                    <Button variant='outline' disabled={busy}>
                      Reopen run
                    </Button>
                  }
                  title='Reopen this payroll run?'
                  description='The run returns to editable and is recalculated from current employee configuration. Swept medical and overtime return to the pool, and employees can no longer see their payslips. Finalize again to lock it.'
                  confirmLabel='Reopen run'
                  destructive
                  isLoading={unlock.isPending}
                  onConfirm={() => unlock.execute({ run_id: run.id })}
                />
              )}
              {locked && (
                <ExportPayoneerSheet
                  runId={run.id}
                  rows={exportRows}
                  disabled={busy}
                />
              )}
              {!locked ? (
                <ConfirmDialog
                  trigger={
                    <Button disabled={busy || gridRows.length === 0}>
                      Finalize run
                    </Button>
                  }
                  title='Finalize this payroll run?'
                  description='Figures become read-only once finalized, approved medical and overtime for the month are swept into this run, and employees can see their payslips. No emails go out yet — send them with "Send notifications". You can still export for Payoneer or reopen the run afterward.'
                  confirmLabel='Finalize run'
                  destructive
                  isLoading={lock.isPending}
                  onConfirm={() => lock.execute({ run_id: run.id })}
                />
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button
                      iconLeft={Send}
                      disabled={busy || gridRows.length === 0}
                    >
                      Send notifications
                    </Button>
                  }
                  title='Send payslip notifications?'
                  description='Emails every employee in this run their payslip PDF. Sending again re-sends to everyone.'
                  confirmLabel='Send notifications'
                  isLoading={sendAll.isPending}
                  onConfirm={() => sendAll.execute({ run_id: run.id })}
                />
              )}
            </div>
          </div>

          {rowsLoading ? (
            <Skeleton className='h-48 rounded-xl' />
          ) : gridRows.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title='No payslips yet'
              description='Calculate payroll to generate the draft for every active employee.'
            >
              <Button
                isLoading={calc.isPending}
                onClick={() => calc.execute({ run_id: run.id })}
              >
                Calculate payroll
              </Button>
            </EmptyState>
          ) : (
            <>
              <CurrentCycleTable
                rows={gridRows}
                locked={locked}
                isBusy={busy}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                onDaysWorkedCommit={(payslipId, daysWorked) =>
                  overrideDays.execute({
                    payslip_id: payslipId,
                    days_worked: daysWorked,
                  })
                }
                onOtMultiplierCommit={(payslipId, multiplier) =>
                  overrideMult.execute({
                    run_id: run.id,
                    payslip_ids: [payslipId],
                    overtime_multiplier: multiplier,
                  })
                }
                onOtHoursCommit={(payslipId, hours) =>
                  overrideOtHours.execute({
                    payslip_id: payslipId,
                    overtime_hours: hours,
                  })
                }
                onAddCustomField={(payslipId, field) =>
                  addField.execute({
                    run_id: run.id,
                    payslip_ids: [payslipId],
                    label: field.label,
                    amount: field.amount,
                  })
                }
                onRemoveCustomField={(payslipId, index) =>
                  removeField.execute({ payslip_id: payslipId, index })
                }
              />
              <p className='text-sm text-muted-foreground'>
                {locked ? 'Total payroll' : 'Draft total'}:{' '}
                {formatCurrency(totalPayroll)} · {gridRows.length} employees
              </p>
              {locked && <ExportArtifacts runId={run.id} />}
            </>
          )}
        </>
      )}
    </>
  );
}
