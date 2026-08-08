'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { EmployeeAvatar } from '@/components/hrm/employee-avatar';
import { StatusBadge } from '@/components/hrm/status-badge';
import { CenteredCell } from '@/components/ui/data-table/centered-cell';
import { DataTableColumnHeader } from '@/components/ui/data-table/column-header';

import { formatDate } from '@/utils/date-functions';

import { employmentTypeLabels } from '@/constants/hrm-labels';

import { EmployeesTableRowActions } from './employees-table-row-actions';

import { EmployeeListItem } from '@/types/hrm';

// None of the directory's columns hold numeric/ordered data, so none carry a
// sort control — the sort chevrons are dropped (`enableSorting: false`) and each
// header renders as a plain label aligned to its cell (Name left, the rest
// centered). Finding a row is search- and filter-driven instead.
export function useEmployeesTableColumns() {
  return useMemo<ColumnDef<EmployeeListItem>[]>(
    () => [
      {
        id: 'fullName',
        // Accessor spans name + email so the global search box (which only
        // indexes column values) matches on either.
        accessorFn: (row) => `${row.fullName} ${row.email}`,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title='Name'
            className='text-left'
          />
        ),
        cell: ({ row }) => (
          <div className='flex max-w-[260px] items-center gap-2.5'>
            <EmployeeAvatar
              employeeId={row.original.id}
              fullName={row.original.fullName}
              size='lg'
            />
            <div className='flex min-w-0 flex-col'>
              <span className='truncate font-medium'>
                {row.original.fullName}
              </span>
              <span className='truncate text-xs text-muted-foreground'>
                {row.original.email}
              </span>
            </div>
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'designation',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title='Designation'
            align='center'
          />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => (value as string) || '—'}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'department',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Department' />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => (value as string) || '—'}
          />
        ),
        enableSorting: false,
        filterFn: (row, id, value: string[]) =>
          value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'employmentType',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Type' align='center' />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={() =>
              employmentTypeLabels[props.row.original.employmentType]
            }
          />
        ),
        enableSorting: false,
        filterFn: (row, id, value: string[]) =>
          value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: false,
        filterFn: (row, id, value: string[]) =>
          value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'invitedAt',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title='Invited'
            align='center'
          />
        ),
        cell: (props) => (
          <CenteredCell
            {...props}
            formatter={(value) => formatDate(value as string) || '—'}
            className='whitespace-nowrap'
          />
        ),
        enableSorting: false,
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => <EmployeesTableRowActions employee={row.original} />,
        enableSorting: false,
      },
    ],
    [],
  );
}
