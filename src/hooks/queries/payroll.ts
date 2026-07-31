import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { authQuery } from '@/lib/client/auth-query';
import {
  type PayslipDbRow,
  toCustomFields,
  toCycleMonth,
  toPayslip,
} from '@/lib/payroll/to-payslip';

import { QueryKeys } from '@/constants/query-keys';
import { type CustomField } from '@/schema/payroll';

import { PayrollCycle, Payslip } from '@/types/hrm';
import { type Tables } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Run list + a run by month (admin only — RLS `runs_admin_all`).
// ---------------------------------------------------------------------------
type RunRow = Tables<'payroll_runs'> & {
  payslips: { count: number }[];
};

function toPayrollCycle(row: RunRow): PayrollCycle {
  return {
    id: row.id,
    month: toCycleMonth(row.period_month),
    status: row.status,
    totalPayroll: row.total_payroll ?? 0,
    employeeCount: row.payslips?.[0]?.count ?? 0,
    lockedAt: row.locked_at,
  };
}

const fetchPayrollRuns = authQuery(async ({ supabase }) => {
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*, payslips(count)')
    .order('period_month', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toPayrollCycle);
});

/** All payroll runs, newest month first (admin run-list screen). */
export const usePayrollRuns = () =>
  useQuery({
    queryKey: [QueryKeys.PAYROLL_RUNS],
    queryFn: () => fetchPayrollRuns(),
  });

const fetchRunByMonth = authQuery(
  async ({ supabase, params }) => {
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*, payslips(count)')
      .eq('period_month', `${params.month}-01`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toPayrollCycle(data) : null;
  },
  { paramsSchema: z.object({ month: z.string() }) },
);

/** The run for a given 'YYYY-MM' month, or null if none exists yet. */
export const useRunByMonth = (month: string) =>
  useQuery({
    queryKey: [QueryKeys.PAYROLL_RUNS, month],
    queryFn: () => fetchRunByMonth({ month }),
    enabled: !!month,
  });

// ---------------------------------------------------------------------------
// Draft / frozen payslips for a run (admin grid — RLS `payslip_admin_all`).
// ---------------------------------------------------------------------------
/** A payslip row with the employee's name joined, all numerics coerced. Postgres
 *  `numeric` arrives as a string over PostgREST despite the generated `number`
 *  type, so days/hours/rate/multiplier are `Number()`-ed to keep arithmetic right. */
export type RunPayslipRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  /** 'YYYY-MM'. Read off the payslip's denormalized `period_month` so a grid row
   *  carries everything `runRowToPayslip` needs to build the invoice PDF. */
  cycleMonth: string;
  baseSalary: number;
  daysInMonth: number;
  daysWorked: number;
  /** Null means days worked follows approved unpaid leave. */
  daysWorkedOverride: number | null;
  unpaidLeaveDays: number;
  totalBase: number;
  medical: number;
  /** Effective hours the engine paid — the override if one is set, else the
   *  employee's approved overtime logs for the month. */
  overtimeHours: number;
  /** Null when `overtimeHours` is still following the approved logs; a number
   *  when an admin has overridden it. Drives the grid's "reset to logs" affordance. */
  overtimeHoursOverride: number | null;
  overtimeMultiplier: number;
  /** Null means the current employee/company multiplier is authoritative. */
  overtimeMultiplierOverride: number | null;
  overtimeRate: number;
  overtimePay: number;
  taxDeduction: number;
  customFields: CustomField[];
  totalPay: number;
  notificationStatus?: 'pending' | 'sent' | 'failed';
  notificationSentAt?: string | null;
  notificationLastError?: string | null;
  notificationAttempts?: number;
};

function toRunPayslipRow(row: PayslipDbRow): RunPayslipRow {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? '',
    designation: row.designation ?? '',
    cycleMonth: toCycleMonth(row.period_month),
    baseSalary: row.base_salary,
    daysInMonth: row.days_in_month,
    daysWorked: Number(row.days_worked),
    daysWorkedOverride:
      row.days_worked_override === null
        ? null
        : Number(row.days_worked_override),
    unpaidLeaveDays: Number(row.unpaid_leave_days),
    totalBase: row.total_base,
    medical: row.medical,
    overtimeHours: Number(row.overtime_hours),
    // Tested against null rather than for truthiness: 0 is a legitimate
    // override ("this employee worked no overtime this month") and must stay
    // distinct from null ("no override — follow the logs").
    overtimeHoursOverride:
      row.overtime_hours_override === null
        ? null
        : Number(row.overtime_hours_override),
    overtimeMultiplier: row.overtime_multiplier
      ? Number(row.overtime_multiplier)
      : 0,
    overtimeMultiplierOverride:
      row.overtime_multiplier_override === null
        ? null
        : Number(row.overtime_multiplier_override),
    overtimeRate: Number(row.overtime_rate),
    overtimePay: row.overtime_pay,
    taxDeduction: row.tax_deduction,
    customFields: toCustomFields(row.custom_fields),
    totalPay: row.total_pay,
    notificationStatus: row.notification_status,
    notificationSentAt: row.notification_sent_at,
    notificationLastError: row.notification_last_error,
    notificationAttempts: row.notification_attempts,
  };
}

/** Widen a grid row to the `Payslip` domain shape the PDF renderer takes, so the
 *  admin can preview an invoice straight from the run table. The two differ only
 *  in `totalPay` vs `total` plus the grid-only `unpaidLeaveDays`. */
export const runRowToPayslip = (row: RunPayslipRow): Payslip => ({
  id: row.id,
  employeeId: row.employeeId,
  employeeName: row.employeeName,
  designation: row.designation,
  cycleMonth: row.cycleMonth,
  baseSalary: row.baseSalary,
  daysWorked: row.daysWorked,
  daysInMonth: row.daysInMonth,
  totalBase: row.totalBase,
  medical: row.medical,
  overtimeHours: row.overtimeHours,
  overtimeRate: row.overtimeRate,
  overtimeMultiplier: row.overtimeMultiplier,
  overtimePay: row.overtimePay,
  taxDeduction: row.taxDeduction,
  customFields: row.customFields,
  total: row.totalPay,
});

const fetchRunPayslips = authQuery(
  async ({ supabase, params }) => {
    const { data, error } = await supabase
      .from('payslips')
      .select('*, employees(full_name)')
      .eq('payroll_run_id', params.runId);
    if (error) throw new Error(error.message);
    return data
      .map(toRunPayslipRow)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  },
  { paramsSchema: z.object({ runId: z.string() }) },
);

/** Payslips for one run, sorted by employee name. Drives the admin draft grid. */
export const useRunPayslips = (runId?: string) =>
  useQuery({
    queryKey: [QueryKeys.RUN_PAYSLIPS, runId],
    queryFn: () => fetchRunPayslips({ runId: runId! }),
    enabled: !!runId,
  });

// ---------------------------------------------------------------------------
// A single employee's payslips (employee's own page + admin employee-detail
// tab). RLS scopes the employee to their own *locked* payslips; an admin reads
// anyone's. Mapped onto the `Payslip` domain type the PDF / table / export use.
// ---------------------------------------------------------------------------
const fetchEmployeePayslips = authQuery(
  async ({ supabase, params }) => {
    const { data, error } = await supabase
      .from('payslips')
      .select('*, employees(full_name)')
      .eq('employee_id', params.employeeId);
    if (error) throw new Error(error.message);
    return data.map(toPayslip);
  },
  { paramsSchema: z.object({ employeeId: z.string() }) },
);

/** One employee's payslips. Admin employee-detail tab passes an id; the
 *  employee's own /payslips page passes their own (RLS returns only locked). */
export const usePayslips = (employeeId?: string) =>
  useQuery({
    queryKey: [QueryKeys.PAYSLIPS, employeeId],
    queryFn: () => fetchEmployeePayslips({ employeeId: employeeId! }),
    enabled: !!employeeId,
  });
