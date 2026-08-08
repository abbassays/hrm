'use client';

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useMonthFilter } from '@/hooks/use-month-filter';

import { DetailSheet } from '@/components/hrm/detail-sheet';
import { EmptyState } from '@/components/hrm/empty-state';
import { MonthFilter } from '@/components/hrm/month-filter';
import { DataTable } from '@/components/ui/data-table';
import { CenteredCell } from '@/components/ui/data-table/centered-cell';
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header';
import { TableSkeleton } from '@/components/ui/data-table/table-skeleton';

import { cn } from '@/lib/utils';
import { currentYear } from '@/utils/date-functions';
import { formatCurrency } from '@/utils/number-functions';

import { DownloadPayslipButton } from './download-payslip-button';

import { Payslip } from '@/types/hrm';

const getCycleDate = (payslip: Payslip) => payslip.cycleMonth;

function usePayslipsColumns() {
  return useMemo<ColumnDef<Payslip>[]>(
    () => [
      {
        accessorKey: 'cycleMonth',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Cycle' />
        ),
        cell: ({ getValue }) => (
          <span className='font-medium'>{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'totalBase',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Base' align='center' />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => formatCurrency(value as number)}
          />
        ),
      },
      {
        accessorKey: 'medical',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title='Medical'
            align='center'
          />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => formatCurrency(value as number) || '—'}
          />
        ),
      },
      {
        accessorKey: 'overtimePay',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title='Overtime'
            align='center'
          />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => formatCurrency(value as number) || '—'}
          />
        ),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Total' align='center' />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => (
              <span className='font-semibold'>
                {formatCurrency(value as number)}
              </span>
            )}
          />
        ),
      },
      {
        id: 'download',
        header: () => null,
        cell: ({ row }) => (
          <div
            className='flex justify-center'
            onClick={(e) => e.stopPropagation()}
          >
            <DownloadPayslipButton payslip={row.original} iconOnly />
          </div>
        ),
      },
    ],
    [],
  );
}

type PayslipsTableProps = {
  payslips: Payslip[] | undefined;
  isLoading: boolean;
  title?: string;
};

export function PayslipsTable({
  payslips,
  isLoading,
  title,
}: PayslipsTableProps) {
  const columns = usePayslipsColumns();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'cycleMonth', desc: true },
  ]);
  const [selected, setSelected] = useState<Payslip | null>(null);
  // Default to the current year; the filter can widen to all time or a month.
  const { month, setMonth, filtered } = useMonthFilter(
    payslips,
    getCycleDate,
    currentYear(),
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (isLoading) return <TableSkeleton rows={2} columns={6} />;

  if (!payslips?.length) {
    return (
      <EmptyState
        icon={Receipt}
        title='No payslips yet'
        description='Payslips appear here once a payroll cycle is locked.'
      />
    );
  }

  return (
    // Net pay, base salary and deductions — masked in session replays.
    <div className='flex flex-col gap-3' data-ph-mask>
      <div
        className={cn(
          'flex items-center gap-3',
          title ? 'justify-between' : 'justify-end',
        )}
      >
        {!!title && <h2 className='text-xl font-semibold'>{title}</h2>}
        <MonthFilter value={month} onChange={setMonth} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title='No payslips in this period'
          description='Try a different month or year, or switch back to all time.'
        />
      ) : (
        <div className='rounded-lg border border-border'>
          <DataTable table={table} onRowClick={setSelected} />
        </div>
      )}
      {!!selected && (
        <DetailSheet
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          title={format(`${selected.cycleMonth}-01`, 'MMMM yyyy')}
          description={`Payslip for ${selected.employeeName}`}
          fields={[
            {
              label: 'Base Salary',
              value: formatCurrency(selected.baseSalary),
            },
            {
              label: 'Days Worked',
              value: `${selected.daysWorked} of ${selected.daysInMonth} days`,
            },
            { label: 'Total Base', value: formatCurrency(selected.totalBase) },
            {
              label: 'Medical',
              value: formatCurrency(selected.medical) || '—',
            },
            { label: 'Overtime Hours', value: `${selected.overtimeHours}h` },
            {
              label: 'Overtime Rate',
              value: selected.overtimeRate
                ? `${formatCurrency(selected.overtimeRate, 2)} / hr`
                : '—',
            },
            {
              label: 'Overtime Pay',
              value: formatCurrency(selected.overtimePay) || '—',
            },
            {
              label: 'Total',
              value: (
                <span className='font-semibold'>
                  {formatCurrency(selected.total)}
                </span>
              ),
            },
          ]}
          footer={
            <DownloadPayslipButton payslip={selected} className='w-full' />
          }
        />
      )}
    </div>
  );
}
