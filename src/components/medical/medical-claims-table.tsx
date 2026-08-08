'use client';

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { HeartPulse } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/hrm/empty-state';
import { StatusCell } from '@/components/hrm/status-cell';
import { DataTable } from '@/components/ui/data-table';
import { CenteredCell } from '@/components/ui/data-table/centered-cell';
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header';
import { TableSkeleton } from '@/components/ui/data-table/table-skeleton';

import { formatDate } from '@/utils/date-functions';
import { formatCurrency } from '@/utils/number-functions';

import {
  medicalClaimForLabels,
  medicalServiceTypeLabels,
} from '@/constants/hrm-labels';

import { ProofFilesButton } from './proof-files-button';

import { MedicalClaim } from '@/types/hrm';

function useMedicalClaimsColumns() {
  return useMemo<ColumnDef<MedicalClaim>[]>(
    () => [
      {
        accessorKey: 'serviceType',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Service' />
        ),
        cell: ({ row }) => (
          <span className='font-medium'>
            {medicalServiceTypeLabels[row.original.serviceType]}
          </span>
        ),
      },
      {
        accessorKey: 'claimFor',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='For' align='center' />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) =>
              medicalClaimForLabels[value as MedicalClaim['claimFor']]
            }
          />
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title='Amount'
            align='center'
          />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => formatCurrency(value as number)}
          />
        ),
      },
      {
        accessorKey: 'expenseDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Date' align='center' />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => formatDate(value as string)}
            className='whitespace-nowrap'
          />
        ),
      },
      {
        id: 'proofFiles',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Proof' align='center' />
        ),
        cell: ({ row }) => (
          <div className='flex justify-center'>
            <ProofFilesButton files={row.original.proofFiles} />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => (
          <StatusCell
            status={row.original.status}
            rejectionReason={row.original.rejectionReason}
          />
        ),
      },
    ],
    [],
  );
}

type MedicalClaimsTableProps = {
  claims: MedicalClaim[] | undefined;
  isLoading: boolean;
  emptyDescription?: string;
  title?: string;
  /** 'all' | 'YYYY' | 'YYYY-MM' — the period selected by the page-level
   *  month filter. */
  month: string;
};

export function MedicalClaimsTable({
  claims,
  isLoading,
  emptyDescription = 'Claims and their status will show up here.',
  title,
  month,
}: MedicalClaimsTableProps) {
  const columns = useMedicalClaimsColumns();
  // Default to newest-submitted first (createdAt), not a data column, so a claim
  // keeps its place regardless of status — approved/rejected rows stay
  // latest-first. Empty initial sorting preserves this order until the user
  // clicks a column header.
  const [sorting, setSorting] = useState<SortingState>([]);
  const filtered = useMemo(() => {
    const scoped =
      month === 'all'
        ? (claims ?? [])
        : (claims ?? []).filter((claim) => claim.expenseDate.startsWith(month));
    return [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [claims, month]);

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (isLoading) return <TableSkeleton rows={3} columns={6} />;

  if (!claims?.length) {
    return (
      <EmptyState
        icon={HeartPulse}
        title='No medical claims yet'
        description={emptyDescription}
      />
    );
  }

  return (
    // Claim amounts and medical descriptions — masked in session replays.
    <div className='flex flex-col gap-3' data-ph-mask>
      {!!title && <h2 className='text-xl font-semibold'>{title}</h2>}
      {filtered.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title='No medical claims in this period'
          description='Try a different month or year, or switch back to all time.'
        />
      ) : (
        <div className='rounded-lg border border-border'>
          <DataTable table={table} />
        </div>
      )}
    </div>
  );
}
