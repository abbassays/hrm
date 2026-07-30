import { useQuery } from '@tanstack/react-query';

import { authQuery } from '@/lib/client/auth-query';

import { QueryKeys } from '@/constants/query-keys';

import {
  AccountStatus,
  DashboardSummary,
  EmployeeStatusCount,
  PayrollCycleStatus,
} from '@/types/hrm';

// Admin home: the six org-wide counters in a single guarded RPC round-trip. The
// RPC is security definer + asserts is_admin() itself (RLS is bypassed), so a
// non-admin gets a 42501 rather than a partial read — the (admin) route guard
// keeps them off the page in the first place.
type DashboardSummaryRow = {
  pending_leave: number;
  pending_medical: number;
  pending_overtime: number;
  active_employees: number;
  payroll_cycle: PayrollCycleStatus | null;
};

const fetchDashboardSummary = authQuery(
  async ({ supabase }): Promise<DashboardSummary> => {
    const { data, error } = await supabase.rpc('dashboard_summary');
    if (error) throw new Error(error.message);
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('dashboard_summary returned no data');

    const row = data as DashboardSummaryRow;
    return {
      pendingLeave: row.pending_leave,
      pendingMedical: row.pending_medical,
      pendingOvertime: row.pending_overtime,
      activeEmployees: row.active_employees,
      payrollCycle: row.payroll_cycle,
    };
  },
);

/** Admin home: the guarded dashboard_summary() bundle. */
export const useDashboardSummary = () =>
  useQuery({
    queryKey: [QueryKeys.DASHBOARD_SUMMARY],
    queryFn: () => fetchDashboardSummary(),
  });

// Admin: count of employees per account_status. Only statuses actually present
// are returned, so callers should treat a missing status as zero.
const fetchEmployeesByStatus = authQuery(
  async ({ supabase }): Promise<EmployeeStatusCount[]> => {
    const { data, error } = await supabase.rpc('employees_by_status');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      status: row.status as AccountStatus,
      count: row.count,
    }));
  },
);

/** Admin: employee headcount broken down by account_status. */
export const useEmployeesByStatus = () =>
  useQuery({
    queryKey: [QueryKeys.EMPLOYEES_BY_STATUS],
    queryFn: () => fetchEmployeesByStatus(),
  });
