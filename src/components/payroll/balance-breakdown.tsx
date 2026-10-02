'use client';

import { useEffect } from 'react';

import { useFxRates } from '@/hooks/queries/fx-rates';

import { Skeleton } from '@/components/ui/skeleton';

import Logger from '@/utils/logger';
import { formatCurrency } from '@/utils/number-functions';

import { type BalanceCurrency } from '@/constants/payroll-export';

const FX_DECIMAL_PLACES = 2;

export type BalanceBreakdownGroup = {
  currency: BalanceCurrency;
  count: number;
  totalPkr: number;
};

type BalanceBreakdownProps = {
  groups: BalanceBreakdownGroup[];
  providerLabel: string;
  title?: string;
};

export function BalanceBreakdown({
  groups,
  providerLabel,
  title = 'Breakdown by source balance',
}: BalanceBreakdownProps) {
  const { data, isPending, isError, error } = useFxRates();

  useEffect(() => {
    if (isError) Logger.error('Balance breakdown FX lookup failed', error);
  }, [isError, error]);

  return (
    <div className='rounded-lg border border-border px-4 py-3'>
      <p className='mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {title}
      </p>
      <div className='flex flex-col gap-1'>
        {groups.map((group) => {
          const rate = data?.rates[group.currency];
          return (
            <div
              key={group.currency}
              className='flex items-center justify-between text-sm'
            >
              <span className='text-muted-foreground'>
                {group.currency} balance · {group.count}{' '}
                {group.count === 1 ? 'employee' : 'employees'}
              </span>
              {isPending ? (
                <Skeleton className='h-5 w-24' />
              ) : (
                <span className='font-medium'>
                  {rate
                    ? formatCurrency(
                        group.totalPkr * rate,
                        FX_DECIMAL_PLACES,
                        group.currency,
                      )
                    : formatCurrency(group.totalPkr)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!isPending && (
        <p className='mt-2 text-xs text-muted-foreground'>
          {isError
            ? 'Live rates unavailable — showing the PKR totals instead.'
            : `Estimated at today's rate. ${providerLabel} applies its own rate when the payment is sent.`}
        </p>
      )}
    </div>
  );
}
