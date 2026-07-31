'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';

import { unlockPayroll } from '@/actions/payroll';

import { onError } from '@/lib/show-error-toast';

import { QueryKeys } from '@/constants/query-keys';

/** Reopen and recalculate a locked run, then refresh every affected view. */
export function useUnlockPayroll(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useAction(unlockPayroll, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.RUN_PAYSLIPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PAYROLL_RUNS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.PAYSLIPS] });
      // The admin dashboard's payroll-cycle badge reads the latest run's status.
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.DASHBOARD_SUMMARY],
      });
      onSuccess?.();
    },
    onError,
  });
}
