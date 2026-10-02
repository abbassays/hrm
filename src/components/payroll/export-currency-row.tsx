'use client';

import { UserMinus, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/number-functions';

import { type BalanceCurrency } from '@/constants/payroll-export';

import { CurrencySelect } from './currency-select';

import { type PayrollExportRow } from '@/types/hrm';

type ExportCurrencyRowProps = {
  row: PayrollExportRow;
  currency: BalanceCurrency;
  isSelected: boolean;
  isExcluded: boolean;
  onToggleSelected: (employeeId: string) => void;
  onToggleExcluded: (employeeId: string) => void;
  onCurrencyChange: (employeeId: string, currency: BalanceCurrency) => void;
};

export function ExportCurrencyRow({
  row,
  currency,
  isSelected,
  isExcluded,
  onToggleSelected,
  onToggleExcluded,
  onCurrencyChange,
}: ExportCurrencyRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelected(row.employeeId)}
          aria-label={`Select ${row.employeeName}`}
        />
      </TableCell>
      <TableCell
        className={cn(
          'font-medium',
          isExcluded && 'text-muted-foreground line-through',
        )}
      >
        {row.employeeName}
      </TableCell>
      <TableCell
        className={cn(
          'text-center',
          isExcluded && 'text-muted-foreground line-through',
        )}
      >
        {formatCurrency(row.total)}
      </TableCell>
      <TableCell className='text-center'>
        <CurrencySelect
          value={currency}
          // An excluded row is paid from no balance in this file, so the picker
          // would be a lie. The choice is kept, and comes back if they're
          // included again.
          disabled={isExcluded}
          onValueChange={(next) => onCurrencyChange(row.employeeId, next)}
          triggerClassName='mx-auto h-9 w-28'
        />
      </TableCell>
      <TableCell className='text-center'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='mx-auto h-8 w-8 text-muted-foreground'
              aria-label={
                isExcluded
                  ? `Add ${row.employeeName} back to this export`
                  : `Leave ${row.employeeName} out of this export`
              }
              onClick={() => onToggleExcluded(row.employeeId)}
            >
              {isExcluded ? <UserPlus /> : <UserMinus />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isExcluded
              ? 'Excluded — add back to this export'
              : 'Leave out of this export'}
          </TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
