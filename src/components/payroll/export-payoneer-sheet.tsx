'use client';

import { useState } from 'react';

import { useExportPayoneer } from '@/hooks/actions/use-export-payoneer';
import { useExportCurrencySelection } from '@/hooks/use-export-currency-selection';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { BalanceBreakdown } from './balance-breakdown';
import { ExportCurrencyTable } from './export-currency-table';

import { type PayrollExportRow } from '@/types/hrm';

type ExportPayoneerSheetProps = {
  runId: string;
  rows: PayrollExportRow[];
  disabled?: boolean;
};

export function ExportPayoneerSheet({
  runId,
  rows,
  disabled,
}: ExportPayoneerSheetProps) {
  const [open, setOpen] = useState(false);
  const selection = useExportCurrencySelection(rows);
  const { includedRows, excludedIds, breakdown } = selection;

  const exportAction = useExportPayoneer(() => {
    setOpen(false);
    selection.reset();
  });

  const handleExport = () =>
    exportAction.execute({
      run_id: runId,
      currencyByEmployee: selection.currencyByEmployee,
      excludedEmployeeIds: [...excludedIds],
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant='outline' disabled={disabled}>
          Export for Payoneer
        </Button>
      </SheetTrigger>
      <SheetContent className='flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>Export for Payoneer</SheetTitle>
          <SheetDescription>
            Choose the Payoneer balance to pay each employee from. The recipient
            bank account is always PKR, and the amount is the locked payslip
            total. Leave anyone out who isn&apos;t being paid through Payoneer
            this month — it only affects this file.
          </SheetDescription>
        </SheetHeader>

        <ExportCurrencyTable rows={rows} selection={selection} />

        {breakdown.length > 0 && (
          <BalanceBreakdown groups={breakdown} providerLabel='Payoneer' />
        )}

        <SheetFooter className='mt-auto items-center gap-2 sm:justify-between'>
          <span className='text-sm text-muted-foreground'>
            {excludedIds.size > 0
              ? `${includedRows.length} of ${rows.length} in this file`
              : `${rows.length} ${rows.length === 1 ? 'employee' : 'employees'}`}
          </span>
          <div className='flex items-center gap-2'>
            <Button variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={exportAction.isPending}
              disabled={includedRows.length === 0}
              onClick={handleExport}
            >
              Export
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
