'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';

import {
  cancelInvite,
  disableEmployee,
  enableEmployee,
  inviteEmployee,
  resendInvite,
} from '@/actions/employees';

import { onError } from '@/lib/show-error-toast';

import { QueryKeys } from '@/constants/query-keys';

/** Wraps the `inviteEmployee` server action: refreshes the directory on
 *  success and routes errors through the shared toast handler. The caller
 *  passes `onSuccess` to close the dialog / show its own confirmation. */
export function useInviteEmployee(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useAction(inviteEmployee, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES] });
      // A new invited account changes the per-status breakdown.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES_BY_STATUS] });
      onSuccess?.();
    },
    onError,
  });
}

/** Re-send a pending invite. Refreshes the directory (the "Invited" date is
 *  re-stamped) and lets the caller show its own confirmation toast. */
export function useResendInvite(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useAction(resendInvite, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES] });
      onSuccess?.();
    },
    onError,
  });
}

/** Revoke a pending invite — the invitee's account is deleted, so the directory
 *  is refreshed to drop the row. */
export function useCancelInvite(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useAction(cancelInvite, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES] });
      // Dropping the invited account changes the per-status breakdown.
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES_BY_STATUS] });
      onSuccess?.();
    },
    onError,
  });
}

/** Disable an employee while preserving their account, records, and files. */
export function useDisableEmployee(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useAction(disableEmployee, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.DASHBOARD_SUMMARY] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES_BY_STATUS] });
      onSuccess?.();
    },
    onError,
  });
}

/** Restore login access and the employee's pre-disable lifecycle state. */
export function useEnableEmployee(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useAction(enableEmployee, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.DASHBOARD_SUMMARY] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES_BY_STATUS] });
      onSuccess?.();
    },
    onError,
  });
}
