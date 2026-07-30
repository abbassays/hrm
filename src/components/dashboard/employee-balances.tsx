'use client';

import {
  ArrowRight,
  CalendarDays,
  HeartPulse,
  type LucideIcon,
  Receipt,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useMemo } from 'react';

import { useCurrentEmployee } from '@/hooks/queries/employees';
import { useLeaveBalance, useLeaveRequests } from '@/hooks/queries/leave';
import { useMedicalBalance } from '@/hooks/queries/medical';
import { usePayslips } from '@/hooks/queries/payroll';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { formatCurrency } from '@/utils/number-functions';

import { paths } from '@/constants/paths';

type EmployeeDashboardCardProps = {
  title: string;
  icon: LucideIcon;
  value: ReactNode;
  secondary: string;
  footer: ReactNode;
  progress?: number;
  progressLabel?: string;
  status?: string;
  actionLabel?: string;
};

function EmployeeDashboardCard({
  title,
  icon: Icon,
  value,
  secondary,
  footer,
  progress,
  progressLabel,
  status,
  actionLabel,
}: EmployeeDashboardCardProps) {
  return (
    <Card className='flex h-full min-h-64 flex-col'>
      <CardHeader className='pb-4'>
        <div className='flex items-start justify-between gap-4'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>
            {title}
          </CardTitle>
          <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground'>
            <Icon className='size-5' aria-hidden />
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col pt-0'>
        <div className='min-h-14'>
          <p className='text-3xl font-bold tracking-tight'>{value}</p>
          <p className='mt-1 text-sm text-muted-foreground'>{secondary}</p>
        </div>
        {typeof progress === 'number' ? (
          <Progress
            className='mt-5'
            value={progress}
            aria-label={progressLabel}
          />
        ) : (
          <p className='mt-5 flex h-4 items-center gap-2 text-xs text-muted-foreground'>
            <span className='size-2 rounded-full bg-primary' aria-hidden />
            {status}
          </p>
        )}
        <div className='mt-auto border-t pt-4'>
          {actionLabel ? (
            <p className='flex items-center gap-1 text-sm font-medium text-primary'>
              {actionLabel}
              <ArrowRight className='size-4' aria-hidden />
            </p>
          ) : (
            <p className='text-xs text-muted-foreground'>{footer}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeeBalances() {
  // Leave and medical balances are real, scoped to the signed-in employee. The
  // balance RPCs resolve each employee's cap/accrual/pool — a per-employee
  // override if set, else the global setting — so these figures already reflect it.
  const { data: me } = useCurrentEmployee();
  const { data: leaveBalance, isLoading: leaveLoading } = useLeaveBalance(
    me?.id,
  );
  const { data: leaveRequests } = useLeaveRequests(me?.id);
  const { data: medicalBalance, isLoading: medicalLoading } = useMedicalBalance(
    me?.id,
  );

  // Unpaid is excluded from the pool RPC by design, so derive it from the
  // request history — mirrors the /leave balance cards.
  const year = new Date().getFullYear();
  const unpaidTaken = useMemo(
    () =>
      (leaveRequests ?? [])
        .filter(
          (request) =>
            request.type === 'unpaid' &&
            request.status === 'approved' &&
            request.startDate.startsWith(String(year)),
        )
        .reduce((sum, request) => sum + request.days, 0),
    [leaveRequests, year],
  );

  // Latest payslip for the signed-in employee. RLS returns only their own
  // *locked* payslips, so this is empty until a run they're in is locked.
  const { data: payslips } = usePayslips(me?.id);
  const latestPayslip = useMemo(
    () =>
      [...(payslips ?? [])].sort((a, b) =>
        b.cycleMonth.localeCompare(a.cycleMonth),
      )[0],
    [payslips],
  );

  const leaveRemaining = Math.max(
    0,
    (leaveBalance?.poolTotal ?? 0) - (leaveBalance?.used ?? 0),
  );
  const leaveProgress =
    leaveBalance && leaveBalance.poolTotal > 0
      ? Math.min(100, (leaveBalance.used / leaveBalance.poolTotal) * 100)
      : 0;
  const medicalRemaining = Math.max(
    0,
    (medicalBalance?.cap ?? 0) - (medicalBalance?.accrued ?? 0),
  );
  const medicalProgress =
    medicalBalance && medicalBalance.cap > 0
      ? Math.min(100, (medicalBalance.accrued / medicalBalance.cap) * 100)
      : 0;

  if (leaveLoading || medicalLoading || !leaveBalance || !medicalBalance) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Skeleton className='h-64 rounded-xl' />
        <Skeleton className='h-64 rounded-xl' />
        <Skeleton className='h-64 rounded-xl' />
      </div>
    );
  }

  return (
    <div className='grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3'>
      <EmployeeDashboardCard
        title='Leave Pool (Annual)'
        icon={CalendarDays}
        value={`${leaveRemaining} days`}
        secondary={`of ${leaveBalance.poolTotal} days total`}
        progress={leaveProgress}
        progressLabel={`${leaveBalance.used} days used of ${leaveBalance.poolTotal}`}
        footer={`${leaveBalance.used} days used · Unpaid taken: ${unpaidTaken} days`}
      />
      <EmployeeDashboardCard
        title='Medical Allowance'
        icon={HeartPulse}
        value={formatCurrency(medicalBalance.accrued) || '0'}
        secondary={`of ${formatCurrency(medicalBalance.cap)} cap`}
        progress={medicalProgress}
        progressLabel={`${formatCurrency(medicalBalance.accrued)} available of ${formatCurrency(medicalBalance.cap)}`}
        footer={`${formatCurrency(medicalRemaining)} remaining · ${formatCurrency(medicalBalance.monthlyAccrual)}/month`}
      />
      {!!latestPayslip && (
        <Link
          href={paths.employee.payslips}
          className='block h-full rounded-xl transition-shadow hover:shadow-md'
        >
          <EmployeeDashboardCard
            value={formatCurrency(latestPayslip.total)}
            icon={Receipt}
            title='Latest Payslip'
            secondary={`Cycle ${latestPayslip.cycleMonth}`}
            status='Payslip ready to view'
            footer=''
            actionLabel='View payslip'
          />
        </Link>
      )}
    </div>
  );
}
