'use client';

import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

import { usePayrollRuns } from '@/hooks/queries/payroll';

import { EmptyState } from '@/components/hrm/empty-state';
import { PageHeader } from '@/components/hrm/page-header';
import { StatusBadge } from '@/components/hrm/status-badge';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCurrency } from '@/utils/number-functions';

import { paths } from '@/constants/paths';

import { RunCreateDialog } from './run-create-dialog';

export function AdminPayrollPageContent() {
  const { data: runs, isLoading } = usePayrollRuns();

  return (
    <>
      <PageHeader
        title='Payroll'
        description='Create a run, review the draft, lock it, then export for Payoneer or Wise.'
      >
        <RunCreateDialog />
      </PageHeader>

      {isLoading ? (
        <Skeleton className='h-24 rounded-xl' />
      ) : !runs?.length ? (
        <EmptyState
          icon={CalendarClock}
          title='No payroll runs yet'
          description='Create a run for a month to generate its draft payslips.'
        />
      ) : (
        <ul className='flex flex-col divide-y divide-border rounded-lg border border-border'>
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={paths.admin.payrollRun(run.month)}
                className='flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-accent hover:text-accent-foreground'
              >
                <span className='font-medium'>
                  {format(`${run.month}-01`, 'MMMM yyyy')}
                </span>
                <span className='flex items-center gap-3 text-sm text-muted-foreground'>
                  {run.employeeCount} employees
                  {run.status === 'locked'
                    ? ` · ${formatCurrency(run.totalPayroll)}`
                    : ''}
                  <StatusBadge status={run.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
