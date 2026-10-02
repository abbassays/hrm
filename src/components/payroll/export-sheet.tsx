'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
} from '@/components/ui/sheet';

import { defaultWiseReference } from '@/lib/payroll/wise-csv';

import {
  DEFAULT_BALANCE_CURRENCY,
  EXPORT_PROVIDER_DESCRIPTIONS,
  EXPORT_PROVIDER_LABELS,
  EXPORT_PROVIDERS,
  type ExportProvider,
} from '@/constants/payroll-export';
import { type WiseFileInput, wiseFileSchema } from '@/schema/payroll-export';

import { BalanceBreakdown } from './balance-breakdown';
import { ExportCurrencyTable } from './export-currency-table';
import { ExportProviderDialog } from './export-provider-dialog';
import { WiseExportInfo } from './wise-export-info';
import { WiseFileForm } from './wise-file-form';

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
  const [provider, setProvider] = useState<ExportProvider>(EXPORT_PROVIDERS[0]);
  const selection = useExportCurrencySelection(rows);
  const { includedRows, excludedIds } = selection;
  const providerLabel = EXPORT_PROVIDER_LABELS[provider];
  const isWise = provider === 'wise';

  const form = useForm<WiseFileInput>({
    resolver: zodResolver(wiseFileSchema),
    defaultValues: {
      sourceCurrency: DEFAULT_BALANCE_CURRENCY,
      paymentReference: defaultWiseReference(periodMonth),
    },
  });
  // Wise takes one source currency per file, so its breakdown is one group.
  const wiseBreakdown = [
    {
      currency: form.watch('sourceCurrency'),
      count: includedRows.length,
      totalPkr: includedRows.reduce((sum, row) => sum + row.total, 0),
    },
  ].filter((group) => group.count > 0);
  const breakdown = isWise ? wiseBreakdown : selection.breakdown;

  const openFor = (next: ExportProvider) => {
    // Exclusions belong to one provider's file, so they don't carry over.
    if (next !== provider) selection.reset();
    setProvider(next);
    setOpen(true);
  };

  const handleExported = () => {
    setOpen(false);
    selection.reset();
  };
  const payoneerExport = useExportPayoneer(handleExported);
  const wiseExport = useExportWise(handleExported);

  const exportInput = {
    run_id: runId,
    excludedEmployeeIds: [...excludedIds],
  };
  const handleWiseExport = form.handleSubmit((wiseFile) =>
    wiseExport.execute({ ...exportInput, ...wiseFile }),
  );
  const handleExport = isWise
    ? handleWiseExport
    : () =>
        payoneerExport.execute({
          ...exportInput,
          currencyByEmployee: selection.currencyByEmployee,
        });

  return (
    <>
      <ExportProviderDialog disabled={disabled} onSelect={openFor} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className='flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle className='flex items-center gap-1'>
              Export for {providerLabel}
              {isWise && <WiseExportInfo />}
            </SheetTitle>
            <SheetDescription>
              {EXPORT_PROVIDER_DESCRIPTIONS[provider]}
            </SheetDescription>
          </SheetHeader>

          {isWise && <WiseFileForm form={form} onSubmit={handleWiseExport} />}

          <ExportCurrencyTable
            rows={rows}
            selection={selection}
            perRowCurrency={!isWise}
          />

          {breakdown.length > 0 && (
            <BalanceBreakdown
              title={isWise ? 'Estimated cost' : undefined}
              groups={breakdown}
              providerLabel={providerLabel}
            />
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
    </>
  );
}
