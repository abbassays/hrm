'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useExportPayoneer } from '@/hooks/actions/use-export-payoneer';
import { useExportWise } from '@/hooks/actions/use-export-wise';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { defaultWiseReference } from '@/lib/payroll/wise-csv';

import {
  DEFAULT_EXPORT_PROVIDER,
  EXPORT_PROVIDER_DESCRIPTIONS,
  EXPORT_PROVIDER_LABELS,
  EXPORT_PROVIDERS,
  type ExportProvider,
  isExportProvider,
} from '@/constants/payroll-export';
import {
  type WiseReferenceInput,
  wiseReferenceSchema,
} from '@/schema/payroll-export';

import { BalanceBreakdown } from './balance-breakdown';
import { ExportCurrencyTable } from './export-currency-table';
import { WiseReferenceForm } from './wise-reference-form';

import { type PayrollExportRow } from '@/types/hrm';

type ExportSheetProps = {
  runId: string;
  periodMonth: string;
  rows: PayrollExportRow[];
  disabled?: boolean;
};

export function ExportSheet({
  runId,
  periodMonth,
  rows,
  disabled,
}: ExportSheetProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ExportProvider>(
    DEFAULT_EXPORT_PROVIDER,
  );
  const selection = useExportCurrencySelection(rows);
  const { includedRows, excludedIds, breakdown } = selection;
  const providerLabel = EXPORT_PROVIDER_LABELS[provider];

  const form = useForm<WiseReferenceInput>({
    resolver: zodResolver(wiseReferenceSchema),
    defaultValues: { paymentReference: defaultWiseReference(periodMonth) },
  });

  const handleExported = () => {
    setOpen(false);
    selection.reset();
  };
  const payoneerExport = useExportPayoneer(handleExported);
  const wiseExport = useExportWise(handleExported);

  const exportInput = {
    run_id: runId,
    currencyByEmployee: selection.currencyByEmployee,
    excludedEmployeeIds: [...excludedIds],
  };
  const handleWiseExport = form.handleSubmit(({ paymentReference }) =>
    wiseExport.execute({ ...exportInput, paymentReference }),
  );
  const handleExport =
    provider === 'wise'
      ? handleWiseExport
      : () => payoneerExport.execute(exportInput);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant='outline' iconLeft={Download} disabled={disabled}>
          Export
        </Button>
      </SheetTrigger>
      <SheetContent className='flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>Export salaries</SheetTitle>
          <SheetDescription>
            {EXPORT_PROVIDER_DESCRIPTIONS[provider]} Leave anyone out who
            isn&apos;t being paid through {providerLabel} this month — it only
            affects this file.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={provider}
          onValueChange={(next) => {
            if (isExportProvider(next)) setProvider(next);
          }}
        >
          <TabsList className='grid w-full grid-cols-2'>
            {EXPORT_PROVIDERS.map((option) => (
              <TabsTrigger key={option} value={option}>
                {EXPORT_PROVIDER_LABELS[option]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value='wise' className='mt-4'>
            <WiseReferenceForm form={form} onSubmit={handleWiseExport} />
          </TabsContent>
        </Tabs>

        <ExportCurrencyTable rows={rows} selection={selection} />

        {breakdown.length > 0 && (
          <BalanceBreakdown groups={breakdown} providerLabel={providerLabel} />
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
              isLoading={payoneerExport.isPending || wiseExport.isPending}
              disabled={includedRows.length === 0}
              onClick={handleExport}
            >
              Export for {providerLabel}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
