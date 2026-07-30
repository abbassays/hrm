'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';

import {
  resetEmployeeAllowanceOverrides,
  updateEmployeeBank,
  updateEmployeeContact,
  updateEmployeeSocials,
  updateEmploymentDetails,
} from '@/actions/employees';

import { onError } from '@/lib/show-error-toast';

import { QueryKeys } from '@/constants/query-keys';

/** Shared invalidation for the admin profile editor: refresh both the detail
 *  query for this employee and the directory list (designation/type/department
 *  can change what the table shows). */
function useInvalidateEmployee(employeeId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: [QueryKeys.EMPLOYEES, employeeId],
    });
    queryClient.invalidateQueries({ queryKey: [QueryKeys.EMPLOYEES] });
  };
}

export function useUpdateEmployeeContact(
  employeeId: string,
  onSuccess?: () => void,
) {
  const invalidate = useInvalidateEmployee(employeeId);
  return useAction(updateEmployeeContact, {
    onSuccess: () => {
      invalidate();
      onSuccess?.();
    },
    onError,
  });
}

export function useUpdateEmployeeBank(
  employeeId: string,
  onSuccess?: () => void,
) {
  const invalidate = useInvalidateEmployee(employeeId);
  return useAction(updateEmployeeBank, {
    onSuccess: () => {
      invalidate();
      onSuccess?.();
    },
    onError,
  });
}

export function useUpdateEmployeeSocials(
  employeeId: string,
  onSuccess?: () => void,
) {
  const invalidate = useInvalidateEmployee(employeeId);
  return useAction(updateEmployeeSocials, {
    onSuccess: () => {
      invalidate();
      onSuccess?.();
    },
    onError,
  });
}

export function useUpdateEmploymentDetails(
  employeeId: string,
  onSuccess?: () => void,
) {
  const invalidate = useInvalidateEmployee(employeeId);
  const queryClient = useQueryClient();
  return useAction(updateEmploymentDetails, {
    onSuccess: () => {
      invalidate();
      // The leave/medical allowance overrides feed the balance RPCs, so refresh
      // this employee's derived balances (prefix-matches the year-scoped leave
      // key) — the Leave/Medical tabs and their own dashboard read from these.
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.LEAVE_BALANCE, employeeId],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.MEDICAL_BALANCE, employeeId],
      });
      onSuccess?.();
    },
    onError,
  });
}

export function useResetEmployeeAllowanceOverrides(
  employeeId: string,
  onSuccess?: () => void,
) {
  const invalidate = useInvalidateEmployee(employeeId);
  const queryClient = useQueryClient();
  return useAction(resetEmployeeAllowanceOverrides, {
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.LEAVE_BALANCE, employeeId],
      });
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.MEDICAL_BALANCE, employeeId],
      });
      onSuccess?.();
    },
    onError,
  });
}
