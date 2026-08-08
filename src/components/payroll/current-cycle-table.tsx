import { RotateCcw } from 'lucide-react';

import { type RunPayslipRow, runRowToPayslip } from '@/hooks/queries/payroll';

import { EmployeeAvatar } from '@/components/hrm/employee-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { formatCurrency } from '@/utils/number-functions';

import { CustomFieldsCell } from './custom-fields-cell';
import { EditableNumberCell } from './editable-number-cell';
import { SendInvoiceButton } from './send-invoice-button';
import { ViewInvoiceButton } from './view-invoice-button';

type PayslipGridProps = {
  rows: RunPayslipRow[];
  locked: boolean;
  /** True while a recalc/lock is in flight — freezes the editable cells. */
  isBusy?: boolean;
  selectedIds: Set<string>;
  onToggleRow: (payslipId: string) => void;
  onToggleAll: () => void;
  onDaysWorkedCommit: (payslipId: string, daysWorked: number | null) => void;
  onOtMultiplierCommit: (payslipId: string, multiplier: number | null) => void;
  /** `null` clears the override, handing the hours back to the approved logs. */
  onOtHoursCommit: (payslipId: string, hours: number | null) => void;
  onAddCustomField: (
    payslipId: string,
    field: { label: string; amount: number },
  ) => void;
  onRemoveCustomField: (payslipId: string, index: number) => void;
};

/** The draft (or, once locked, frozen) payslip grid for one run. Earnings and
 *  deductions are grouped; OT multiplier, OT hours, unpaid days (the days-worked
 *  override), and the adjustment/deduction line items are editable while the run
 *  is open. Everything else is engine-computed and read-only. */
export function CurrentCycleTable({
  rows,
  locked,
  isBusy,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onDaysWorkedCommit,
  onOtMultiplierCommit,
  onOtHoursCommit,
  onAddCustomField,
  onRemoveCustomField,
}: PayslipGridProps) {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  return (
    // Salaries, overtime pay and net figures — masked in session replays.
    <div className='overflow-x-auto rounded-lg border border-border' data-ph-mask>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead colSpan={2} className='h-8' />
            <TableHead
              colSpan={5}
              className='h-8 border-l border-border bg-muted/50 text-center text-xs font-semibold uppercase tracking-wide'
            >
              Earnings
            </TableHead>
            <TableHead
              colSpan={3}
              className='h-8 border-l border-border bg-muted/30 text-center text-xs font-semibold uppercase tracking-wide'
            >
              Deductions
            </TableHead>
            {/* Net Salary + Actions — ungrouped, so this spans both. */}
            <TableHead colSpan={2} className='h-8 border-l border-border' />
          </TableRow>
          <TableRow>
            <TableHead className='w-10'>
              {!locked && (
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label='Select all rows'
                />
              )}
            </TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className='border-l border-border text-center'>
              Base Salary
            </TableHead>
            <TableHead className='text-center'>Medical</TableHead>
            <TableHead className='text-center'>OT Rate</TableHead>
            <TableHead className='text-center'>Overtime</TableHead>
            <TableHead className='text-center'>Adjustments</TableHead>
            <TableHead className='border-l border-border text-center'>
              Unpaid Leaves
            </TableHead>
            <TableHead className='text-center'>Tax</TableHead>
            <TableHead className='text-center'>Others</TableHead>
            <TableHead className='border-l border-border text-center'>
              Net Salary
            </TableHead>
            <TableHead className='text-center'>Notification</TableHead>
            <TableHead className='text-center'>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            // Adjustments (earnings) and Others (deductions) render disjoint
            // slices of the same custom_fields array; keeping each item's
            // original index lets removal target the right entry.
            const indexedFields = row.customFields.map((field, index) => ({
              field,
              index,
            }));
            const earnedFields = indexedFields.filter(
              ({ field }) => field.amount >= 0,
            );
            const deductedFields = indexedFields.filter(
              ({ field }) => field.amount < 0,
            );
            const unpaidDays = row.daysInMonth - row.daysWorked;
            const unpaidDeduction = row.baseSalary - row.totalBase;

            return (
              <TableRow key={row.id}>
                <TableCell>
                  {!locked ? (
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={() => onToggleRow(row.id)}
                      aria-label={`Select ${row.employeeName}`}
                    />
                  ) : null}
                </TableCell>

                <TableCell className='font-medium'>
                  <span className='flex items-center gap-2.5'>
                    <EmployeeAvatar
                      employeeId={row.employeeId}
                      fullName={row.employeeName}
                      size='sm'
                    />
                    {row.employeeName || '—'}
                  </span>
                </TableCell>
                <TableCell className='border-l border-border text-center'>
                  {formatCurrency(row.baseSalary)}
                </TableCell>
                <TableCell className='text-center'>
                  {formatCurrency(row.medical) || '—'}
                </TableCell>
                <TableCell className='text-center'>
                  {locked ? (
                    `${row.overtimeMultiplier}x`
                  ) : (
                    <div className='flex items-center justify-center gap-1'>
                      <EditableNumberCell
                        value={row.overtimeMultiplier}
                        min={0}
                        max={9.99}
                        step={0.1}
                        disabled={isBusy}
                        ariaLabel={`Overtime multiplier for ${row.employeeName}`}
                        onCommit={(multiplier) =>
                          onOtMultiplierCommit(row.id, multiplier)
                        }
                      />
                      {row.overtimeMultiplierOverride !== null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7 text-muted-foreground'
                              disabled={isBusy}
                              aria-label={`Reset overtime multiplier for ${row.employeeName} to employee configuration`}
                              onClick={() => onOtMultiplierCommit(row.id, null)}
                            >
                              <RotateCcw />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Overridden — reset to employee configuration
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className='text-center'>
                  {locked ? (
                    <span className='whitespace-nowrap'>
                      {row.overtimeHours}h ·{' '}
                      {formatCurrency(row.overtimePay) || '—'}
                    </span>
                  ) : (
                    <div className='flex flex-col items-center gap-0.5'>
                      <div className='flex items-center justify-center gap-1'>
                        <EditableNumberCell
                          value={row.overtimeHours}
                          min={0}
                          max={744}
                          step={0.5}
                          disabled={isBusy}
                          ariaLabel={`Overtime hours for ${row.employeeName}`}
                          onCommit={(hours) => onOtHoursCommit(row.id, hours)}
                        />
                        {/* Only reachable once overridden — an override detaches
                            the row from the approved logs, so this is the way back. */}
                        {row.overtimeHoursOverride !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-7 w-7 text-muted-foreground'
                                disabled={isBusy}
                                aria-label={`Reset overtime hours for ${row.employeeName} to the approved logs`}
                                onClick={() => onOtHoursCommit(row.id, null)}
                              >
                                <RotateCcw />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Overridden — reset to approved logs
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <span className='text-xs text-muted-foreground'>
                        {formatCurrency(row.overtimePay) || 'No overtime'}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className='text-center'>
                  <div className='flex justify-center'>
                    <CustomFieldsCell
                      fields={earnedFields.map(({ field }) => field)}
                      employeeName={row.employeeName}
                      kind='earning'
                      disabled={locked}
                      isSubmitting={isBusy}
                      onAdd={(field) =>
                        onAddCustomField(row.id, {
                          label: field.label,
                          amount: Math.abs(field.amount),
                        })
                      }
                      onRemove={(i) =>
                        onRemoveCustomField(row.id, earnedFields[i].index)
                      }
                    />
                  </div>
                </TableCell>
                <TableCell className='border-l border-border text-center'>
                  {locked ? (
                    <span className='whitespace-nowrap'>
                      {unpaidDays}d · {formatCurrency(unpaidDeduction) || '—'}
                    </span>
                  ) : (
                    <div className='flex flex-col items-center gap-0.5'>
                      <div className='flex items-center justify-center gap-1'>
                        <EditableNumberCell
                          value={unpaidDays}
                          min={0}
                          max={row.daysInMonth}
                          step={0.5}
                          disabled={isBusy}
                          ariaLabel={`Unpaid days for ${row.employeeName}`}
                          onCommit={(unpaid) =>
                            onDaysWorkedCommit(row.id, row.daysInMonth - unpaid)
                          }
                        />
                        {row.daysWorkedOverride !== null && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-7 w-7 text-muted-foreground'
                                disabled={isBusy}
                                aria-label={`Reset unpaid days for ${row.employeeName} to approved leave`}
                                onClick={() => onDaysWorkedCommit(row.id, null)}
                              >
                                <RotateCcw />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Overridden — reset to approved leave
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <span className='text-xs text-muted-foreground'>
                        {formatCurrency(unpaidDeduction) || 'No deduction'}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className='text-center'>
                  {formatCurrency(row.taxDeduction) || '—'}
                </TableCell>
                <TableCell className='text-center'>
                  <div className='flex justify-center'>
                    <CustomFieldsCell
                      fields={deductedFields.map(({ field }) => ({
                        label: field.label,
                        amount: Math.abs(field.amount),
                      }))}
                      employeeName={row.employeeName}
                      kind='deduction'
                      disabled={locked}
                      isSubmitting={isBusy}
                      onAdd={(field) =>
                        onAddCustomField(row.id, {
                          label: field.label,
                          amount: -Math.abs(field.amount),
                        })
                      }
                      onRemove={(i) =>
                        onRemoveCustomField(row.id, deductedFields[i].index)
                      }
                    />
                  </div>
                </TableCell>
                <TableCell className='border-l border-border text-center font-semibold'>
                  {formatCurrency(row.totalPay)}
                </TableCell>
                <TableCell className='text-center'>
                  <div className='flex items-center justify-center'>
                    {row.notificationStatus === 'sent' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant='default'>Sent</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.notificationSentAt
                            ? new Date(row.notificationSentAt).toLocaleString()
                            : 'Sent'}
                        </TooltipContent>
                      </Tooltip>
                    ) : row.notificationStatus === 'failed' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant='destructive'>Failed</Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.notificationLastError ?? 'Error sending'}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge variant='secondary'>Pending</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-center gap-1'>
                    <ViewInvoiceButton payslip={runRowToPayslip(row)} />
                    <SendInvoiceButton
                      payslipId={row.id}
                      employeeName={row.employeeName}
                      disabled={!locked}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
