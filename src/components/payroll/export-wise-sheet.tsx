'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useExportWise } from '@/hooks/actions/use-export-wise';
import { useExportCurrencySelection } from '@/hooks/use-export-currency-selection';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { defaultWiseReference } from '@/lib/payroll/wise-csv';

import { WISE_REFERENCE_MAX_LENGTH } from '@/constants/payroll-export';
import {
  type WiseReferenceInput,
  wiseReferenceSchema,
} from '@/schema/payroll-export';

import { BalanceBreakdown } from './balance-breakdown';
import { ExportCurrencyTable } from './export-currency-table';

import { type PayrollExportRow } from '@/types/hrm';

type ExportWiseSheetProps = {
  runId: string;
  periodMonth: string;
  rows: PayrollExportRow[];
  disabled?: boolean;
};

export function ExportWiseSheet({
  runId,
  periodMonth,
  rows,
  disabled,
}: ExportWiseSheetProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const selection = useExportCurrencySelection(rows);
  const { includedRows, excludedIds, breakdown } = selection;

  const form = useForm<WiseReferenceInput>({
    resolver: zodResolver(wiseReferenceSchema),
    defaultValues: { paymentReference: defaultWiseReference(periodMonth) },
  });

  const exportAction = useExportWise(() => {
    setOpen(false);
    selection.reset();
  });

  const handleExport = ({ paymentReference }: WiseReferenceInput) =>
    exportAction.execute({
      run_id: runId,
      currencyByEmployee: selection.currencyByEmployee,
      excludedEmployeeIds: [...excludedIds],
      paymentReference,
    });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant='outline' disabled={disabled}>
          Export for Wise
        </Button>
      </SheetTrigger>
      <SheetContent className='flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>Export for Wise</SheetTitle>
          <SheetDescription>
            Choose the Wise balance to pay each employee from. The recipient
            account is always PKR, and the amount is the locked payslip total —
            what the employee receives, not what Wise debits. Leave anyone out
            who isn&apos;t being paid through Wise this month — it only affects
            this file.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form id={formId} onSubmit={form.handleSubmit(handleExport)}>
            <FormField
              control={form.control}
              name='paymentReference'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment reference</FormLabel>
                  <FormControl>
                    <Input maxLength={WISE_REFERENCE_MAX_LENGTH} {...field} />
                  </FormControl>
                  <FormDescription>
                    Sent with every transfer in this file.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <ExportCurrencyTable rows={rows} selection={selection} />

        {breakdown.length > 0 && (
          <BalanceBreakdown groups={breakdown} providerLabel='Wise' />
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
              type='submit'
              form={formId}
              isLoading={exportAction.isPending}
              disabled={includedRows.length === 0}
            >
              Export
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
