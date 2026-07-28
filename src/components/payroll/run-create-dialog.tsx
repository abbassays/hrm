'use client';

import { PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useCreateRun } from '@/hooks/actions/use-create-run';
import { usePayrollRuns } from '@/hooks/queries/payroll';

import { ScrollableDialogContent } from '@/components/hrm/scrollable-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MonthSelector } from '@/components/ui/month-selector';

import { firstAvailableMonth } from '@/utils/payroll-functions';

import { paths } from '@/constants/paths';

/** Create a run for any month that doesn't have one yet (current, back-dated, or
 *  future). `days_in_month` is derived server-side. Months with an existing run
 *  are disabled in the picker — `period_month` is unique, so creating one there
 *  would silently drop the admin on the old run instead. On success we navigate
 *  to the run's screen. */
export function RunCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Null until the admin picks — the default depends on `runs`, which the run
  // list has usually already cached but isn't guaranteed to have on first render.
  const [month, setMonth] = useState<string | null>(null);

  const { data: runs, isLoading } = usePayrollRuns();
  const takenMonths = useMemo(
    () => runs?.map((run) => run.month) ?? [],
    [runs],
  );

  const selectedMonth = month ?? firstAvailableMonth(takenMonths);
  const isTaken = takenMonths.includes(selectedMonth);

  const { execute, isPending } = useCreateRun((run) => {
    setOpen(false);
    const target = run ? run.period_month.slice(0, 7) : selectedMonth;
    router.push(paths.admin.payrollRun(target));
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button iconLeft={PlusCircle}>Create payroll</Button>
      </DialogTrigger>
      <ScrollableDialogContent>
        <DialogHeader>
          <DialogTitle>Create a payroll run</DialogTitle>
          <DialogDescription>
            Pick the month to run payroll for. The number of days in the month
            is derived automatically.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          <Label>Month</Label>
          <MonthSelector
            value={selectedMonth}
            onChange={setMonth}
            disabledMonths={takenMonths}
          />
          <p className='text-sm text-muted-foreground'>
            Months that already have a run are disabled.
          </p>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            disabled={isLoading || isTaken}
            onClick={() => execute({ period_month: `${selectedMonth}-01` })}
          >
            Create run
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
