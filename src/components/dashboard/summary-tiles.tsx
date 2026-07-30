'use client';

import { Banknote, CheckSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useDashboardSummary } from '@/hooks/queries/dashboard';

import { StatCard } from '@/components/hrm/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import Logger from '@/utils/logger';

import { payrollCycleStatusLabels } from '@/constants/hrm-labels';
import { paths } from '@/constants/paths';

const tileLink =
  'block rounded-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-ring';

/**
 * Admin-home summary tiles, driven by the single guarded dashboard_summary()
 * RPC. Combined pending is derived here from the one payload (never four count
 * queries). Each tile deep-links into the matching admin surface.
 */
export function SummaryTiles() {
  const { data, isPending, isError, error } = useDashboardSummary();

  useEffect(() => {
    if (isError) {
      Logger.error('Dashboard summary fetch failed', error);
      toast.error('Could not load dashboard', {
        description: 'The summary counts failed to load. Try refreshing.',
      });
    }
  }, [isError, error]);

  if (isError) {
    return (
      <Card>
        <CardContent className='p-6 text-sm text-muted-foreground'>
          Couldn&apos;t load the dashboard summary. Please refresh to try again.
        </CardContent>
      </Card>
    );
  }

  if (isPending || !data) {
    return (
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <Skeleton className='h-[104px] rounded-xl' />
        <Skeleton className='h-[104px] rounded-xl' />
        <Skeleton className='h-[104px] rounded-xl' />
      </div>
    );
  }

  const pendingTotal =
    data.pendingLeave + data.pendingMedical + data.pendingOvertime;

  const cycle = data.payrollCycle
    ? payrollCycleStatusLabels[data.payrollCycle]
    : null;

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      <Link href={paths.admin.approvals} className={tileLink}>
        <StatCard
          label='Pending Approvals'
          value={pendingTotal}
          icon={CheckSquare}
          hint='Leave, medical & overtime'
        />
      </Link>

      <Link href={paths.admin.employees} className={tileLink}>
        <StatCard
          label='Active Employees'
          value={data.activeEmployees}
          icon={Users}
          hint='Currently on staff'
        />
      </Link>

      <Link href={paths.admin.payroll} className={tileLink}>
        <Card>
          <CardContent className='flex items-start justify-between gap-4 p-6'>
            <div className='flex flex-col gap-2'>
              <p className='text-sm text-muted-foreground'>Payroll Cycle</p>
              {cycle ? (
                <Badge variant={cycle.variant} className='w-fit text-sm'>
                  {cycle.label}
                </Badge>
              ) : (
                <p className='text-sm font-medium text-muted-foreground'>
                  No runs yet
                </p>
              )}
              <p className='text-xs text-muted-foreground'>Latest run status</p>
            </div>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground'>
              <Banknote className='size-5' aria-hidden />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
