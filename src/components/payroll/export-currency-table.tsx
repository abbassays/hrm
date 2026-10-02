'use client';

import { type ExportCurrencySelection } from '@/hooks/use-export-currency-selection';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { CurrencySelect } from './currency-select';
import { ExportCurrencyRow } from './export-currency-row';

import { type PayrollExportRow } from '@/types/hrm';

type ExportCurrencyTableProps = {
  rows: PayrollExportRow[];
  selection: ExportCurrencySelection;
  perRowCurrency: boolean;
};

export function ExportCurrencyTable({
  rows,
  selection,
  perRowCurrency,
}: ExportCurrencyTableProps) {
  const { selectedIds, excludedIds } = selection;

  return (
    <>
      {perRowCurrency && selectedIds.size > 0 && (
        <div className='flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2'>
          <span className='text-sm text-muted-foreground'>
            {selectedIds.size} selected
          </span>
          <CurrencySelect
            value={selection.bulkCurrency}
            onValueChange={selection.setBulkCurrency}
            triggerClassName='h-8 w-28'
          />
          <Button type='button' size='sm' onClick={selection.applyBulkCurrency}>
            Apply to selected
          </Button>
        </div>
      )}

      <div className='rounded-lg border border-border'>
        <Table>
          <TableHeader>
            <TableRow>
              {perRowCurrency && (
                <TableHead className='w-10'>
                  <Checkbox
                    checked={selection.allSelected}
                    onCheckedChange={selection.toggleAll}
                    aria-label='Select all rows'
                  />
                </TableHead>
              )}
              <TableHead>Employee</TableHead>
              <TableHead className='text-right'>Amount (PKR)</TableHead>
              {perRowCurrency && (
                <TableHead className='text-center'>Pay from</TableHead>
              )}
              <TableHead className='w-20 whitespace-nowrap text-center'>
                In file
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ExportCurrencyRow
                key={row.employeeId}
                row={row}
                perRowCurrency={perRowCurrency}
                currency={selection.currencyFor(row.employeeId)}
                isSelected={selectedIds.has(row.employeeId)}
                isExcluded={excludedIds.has(row.employeeId)}
                onToggleSelected={selection.toggleSelected}
                onToggleExcluded={selection.toggleExcluded}
                onCurrencyChange={selection.setCurrencyFor}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
