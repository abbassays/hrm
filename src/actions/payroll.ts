'use server';

import { format } from 'date-fns';

import {
  payslipFileName,
  renderPayslipPdf,
} from '@/lib/payroll/render-payslip-pdf';
import { toCustomFields, toPayslip } from '@/lib/payroll/to-payslip';
import { sendInvoiceEmail } from '@/lib/resend/send-invoice-emails';
import { authActionClient } from '@/lib/server/safe-action';
import { supabaseAdmin } from '@/lib/supabase/admin';
import Logger from '@/utils/logger';

import { appConfig } from '@/config/app';
import { paths } from '@/constants/paths';
import {
  addCustomFieldSchema,
  createRunSchema,
  type CustomField,
  overrideDaysWorkedSchema,
  overrideOtHoursSchema,
  overrideOtMultiplierSchema,
  removeCustomFieldSchema,
  runIdSchema,
  sendInvoiceSchema,
  updatePayrollSettingsSchema,
} from '@/schema/payroll';

/** Admin gate. The role check is server-side even though RLS / the RPC's own
 *  `is_admin()` guard also enforce it (mirrors `actions/overtime.ts`). */
const requireAdmin = (role?: string) => {
  if (role !== 'admin') throw new Error('Forbidden');
};

/**
 * Mail each listed payslip to its employee as a PDF invoice, and report how many
 * landed. Runs service-role (`supabaseAdmin`) to read employee emails alongside
 * the payslip figures in one query.
 *
 * Every payslip is rendered and sent independently (`allSettled`), so one
 * missing address or one unrenderable PDF can't take the rest of a run's
 * invoices down with it. The figures are read back from the DB rather than
 * accepted from the caller, so a client can never mail a doctored payslip.
 */
async function dispatchInvoices(payslipIds: string[]) {
  if (payslipIds.length === 0) return { sent: 0, failed: 0 };

  const { data: rows, error } = await supabaseAdmin
    .from('payslips')
    .select('*, employees(full_name, email)')
    .in('id', payslipIds);
  if (error) throw new Error(error.message);

  const payslipsUrl = new URL(
    paths.employee.payslips,
    appConfig.appUrl,
  ).toString();

  const results = await Promise.allSettled(
    (rows ?? []).map(async (row) => {
      const to = row.employees?.email;
      if (!to) throw new Error(`Payslip ${row.id} has no employee email`);

      const payslip = toPayslip(row);
      const content = await renderPayslipPdf(payslip);

      await sendInvoiceEmail({
        to,
        fullName: payslip.employeeName || null,
        cycleLabel: format(`${payslip.cycleMonth}-01`, 'MMMM yyyy'),
        payslipsUrl,
        pdf: { filename: payslipFileName(payslip), content },
      });
    }),
  );

  // Update DB per-recipient so UI can surface sent/failed statuses.
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < (rows ?? []).length; i += 1) {
    const row = (rows ?? [])[i];
    const res = results[i];
    try {
      if (res.status === 'fulfilled') {
        sent += 1;
        const { error: updateErr } = await supabaseAdmin
          .from('payslips')
          .update({
            notification_status: 'sent',
            notification_sent_at: new Date().toISOString(),
            notification_attempts: (row.notification_attempts ?? 0) + 1,
            notification_last_error: null,
          })
          .eq('id', row.id);
        if (updateErr)
          Logger.error(
            'Failed to update payslip notification status',
            updateErr.message,
          );
      } else {
        failed += 1;
        const errorText = (res as PromiseRejectedResult).reason?.message
          ? String((res as PromiseRejectedResult).reason?.message)
          : 'Unknown error';
        const { error: updateErr } = await supabaseAdmin
          .from('payslips')
          .update({
            notification_status: 'failed',
            notification_attempts: (row.notification_attempts ?? 0) + 1,
            notification_last_error: errorText.slice(0, 1024),
          })
          .eq('id', row.id);
        if (updateErr)
          Logger.error(
            'Failed to update payslip notification status',
            updateErr.message,
          );
      }
    } catch (e) {
      Logger.error('Error updating payslip notification status', e);
    }
  }

  const failures = results.filter((r) => r.status === 'rejected');
  failures.forEach((failure) =>
    Logger.error('Failed to send invoice email', failure),
  );

  return { sent, failed };
}

/** Last calendar day of the month a first-of-month ISO date falls in. Derived
 *  server-side so a client can never spoof `days_in_month` (it drives proration). */
const daysInMonth = (periodMonth: string) => {
  const [year, month] = periodMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

/**
 * Update the single `payroll_settings` row. Admin-only. The row is seeded by the
 * migration and only ever UPDATEd (RLS `settings_write`), so this maps the
 * submitted camelCase subset onto the DB columns and writes just those keys.
 */
export const updatePayrollSettings = authActionClient
  .schema(updatePayrollSettingsSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const patch: Record<string, number> = {};
    if (parsedInput.overtimeMultiplier !== undefined)
      patch.ot_multiplier_default = parsedInput.overtimeMultiplier;
    if (parsedInput.leavePoolDays !== undefined)
      patch.leave_pool_days = parsedInput.leavePoolDays;
    if (parsedInput.medicalMonthlyAccrual !== undefined)
      patch.medical_accrual_monthly = parsedInput.medicalMonthlyAccrual;
    if (parsedInput.medicalBalanceCap !== undefined)
      patch.medical_cap = parsedInput.medicalBalanceCap;
    if (parsedInput.taxRatePercent !== undefined)
      patch.tax_rate_percent = parsedInput.taxRatePercent;

    const employeeScope = parsedInput.employeeScope ?? 'defaults';

    const { error } = await supabase
      .from('payroll_settings')
      .update(patch)
      .eq('id', true);
    if (error) throw new Error(error.message);

    // Employees with null allowance fields automatically inherit the global
    // settings above. An admin can instead explicitly replace every employee's
    // per-employee allowances with these values.
    let employeesUpdated = 0;
    if (employeeScope === 'all') {
      if (
        parsedInput.leavePoolDays === undefined ||
        parsedInput.medicalMonthlyAccrual === undefined ||
        parsedInput.medicalBalanceCap === undefined ||
        parsedInput.overtimeMultiplier === undefined
      ) {
        throw new Error(
          'All allowance settings are required when applying them to every employee.',
        );
      }

      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id')
        .eq('role', 'employee');
      if (employeesError) throw new Error(employeesError.message);

      const rows = (employees ?? []).map((employee) => ({
        employee_id: employee.id,
        leave_pool_days_override: parsedInput.leavePoolDays,
        medical_accrual_monthly_override: parsedInput.medicalMonthlyAccrual,
        medical_cap_override: parsedInput.medicalBalanceCap,
        ot_multiplier_override: parsedInput.overtimeMultiplier,
      }));

      if (rows.length > 0) {
        const { error: overridesError } = await supabase
          .from('employment_details')
          .upsert(rows, { onConflict: 'employee_id' });
        if (overridesError) throw new Error(overridesError.message);
      }
      employeesUpdated = rows.length;
    }

    return { updated: Object.keys(patch), employeesUpdated, employeeScope };
  });

/**
 * Create an `open` run for a month (the manual "Create run" button — used for
 * the current, a back-dated, or a future month). `days_in_month` is derived
 * server-side. `period_month` is unique, so a duplicate create resolves to the
 * existing run rather than erroring.
 */
export const createRun = authActionClient
  .schema(createRunSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data, error } = await supabase
      .from('payroll_runs')
      .insert({
        period_month: parsedInput.period_month,
        days_in_month: daysInMonth(parsedInput.period_month),
        status: 'open',
      })
      .select('id, period_month')
      .single();

    // Unique(period_month) violation → the run already exists; return it so the
    // caller can just navigate to it (create is idempotent from the UI's view).
    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: fetchError } = await supabase
          .from('payroll_runs')
          .select('id, period_month')
          .eq('period_month', parsedInput.period_month)
          .single();
        if (fetchError) throw new Error(fetchError.message);
        return existing;
      }
      throw new Error(error.message);
    }

    return data;
  });

/**
 * Generate / recalculate the draft payslips for a run. Idempotent; the RPC
 * refuses on a locked run (55000) and re-asserts admin (42501). Admin-guarded
 * here too for a fast, friendly failure before the round-trip.
 */
export const calculatePayroll = authActionClient
  .schema(runIdSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase.rpc('calculate_payroll', {
      p_run_id: parsedInput.run_id,
    });
    if (error) throw new Error(error.message);
    return { run_id: parsedInput.run_id };
  });

/**
 * Finalize a run: sweep-stamp approved medical/OT, freeze `total_payroll`, flip
 * to `locked`. The RPC is transactional and refuses a second lock (55000).
 *
 * Locking is what makes the figures final and the payslips visible to employees
 * under RLS. It deliberately mails nothing: sending payslip notifications is a
 * separate, explicit step (`sendRunInvoices`, the "Send notifications" button on
 * a locked run), so an admin decides exactly when employees are emailed.
 */
export const lockPayroll = authActionClient
  .schema(runIdSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase.rpc('lock_payroll', {
      p_run_id: parsedInput.run_id,
    });
    if (error) throw new Error(error.message);
    return { run_id: parsedInput.run_id };
  });

/**
 * Reopen a locked run — the transactional reverse of `lockPayroll`. Releases the
 * medical/OT this run swept back to the pool, clears the frozen total, and flips
 * `locked → open` so the figures are editable and recalculable again. Employees
 * stop seeing their payslips automatically (RLS scopes them to locked runs). The
 * RPC refuses a run that isn't locked (55000).
 */
export const unlockPayroll = authActionClient
  .schema(runIdSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);
    const { error } = await supabase.rpc('unlock_payroll', {
      p_run_id: parsedInput.run_id,
    });
    if (error) throw new Error(error.message);
    return { run_id: parsedInput.run_id };
  });

/**
 * Mail every payslip in a locked run to its employee — the "Send notifications"
 * button. Finalizing no longer emails anyone, so this is the explicit fan-out;
 * clicking it again re-sends to everyone (there is no per-employee sent flag).
 * Refused until the run is locked: the figures aren't final before that, and
 * employees can't see the payslips under RLS either. Reports the same
 * `{ sent, failed }` tally as the per-row send, via `dispatchInvoices`.
 */
export const sendRunInvoices = authActionClient
  .schema(runIdSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('status')
      .eq('id', parsedInput.run_id)
      .single();
    if (runError) throw new Error(runError.message);
    if (run.status !== 'locked')
      throw new Error('Finalize the run before sending notifications.');

    const { data: rows, error: readError } = await supabase
      .from('payslips')
      .select('id')
      .eq('payroll_run_id', parsedInput.run_id);
    if (readError) throw new Error(readError.message);

    const invoices = await dispatchInvoices((rows ?? []).map((row) => row.id));
    return { run_id: parsedInput.run_id, invoices };
  });

/**
 * Mail one payslip's invoice to its employee — the per-row Send button, i.e. a
 * single-row send/re-send of what "Send notifications" (`sendRunInvoices`) fans
 * out to the whole run. Refused until the run is locked: the figures aren't
 * final before that, and the employee can't see the payslip under RLS either.
 *
 * Unlike the batch fan-out, a failure here IS the outcome of the click, so it
 * throws rather than being logged and swallowed.
 */
export const sendPayslipInvoice = authActionClient
  .schema(sendInvoiceSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: payslip, error } = await supabase
      .from('payslips')
      .select('id, payroll_runs(status)')
      .eq('id', parsedInput.payslip_id)
      .single();
    if (error) throw new Error(error.message);
    if (payslip.payroll_runs?.status !== 'locked')
      throw new Error('Finalize the run before sending invoices.');

    const { failed } = await dispatchInvoices([payslip.id]);
    if (failed > 0)
      throw new Error(
        'Could not send the invoice. Check the employee has a valid email address, then try again.',
      );

    return { payslip_id: payslip.id };
  });

/**
 * Set an inline days-worked override on one payslip, then recalc the run so the
 * dependent totals refresh. The override survives the recalc (the engine reads
 * the existing `days_worked` and passes it through). Refused on a locked run
 * *before* any write, so a locked payslip is never mutated.
 */
export const overrideDaysWorked = authActionClient
  .schema(overrideDaysWorkedSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: payslip, error: readError } = await supabase
      .from('payslips')
      .select('payroll_run_id, payroll_runs(status)')
      .eq('id', parsedInput.payslip_id)
      .single();
    if (readError) throw new Error(readError.message);
    if (payslip.payroll_runs?.status === 'locked')
      throw new Error('This run is locked and can no longer be edited.');

    const { error: updateError } = await supabase
      .from('payslips')
      .update({ days_worked: parsedInput.days_worked })
      .eq('id', parsedInput.payslip_id);
    if (updateError) throw new Error(updateError.message);

    const { error: recalcError } = await supabase.rpc('calculate_payroll', {
      p_run_id: payslip.payroll_run_id,
    });
    if (recalcError) throw new Error(recalcError.message);

    return { run_id: payslip.payroll_run_id };
  });

/**
 * Set a per-payslip overtime-multiplier override on one or many payslips of a
 * run (single-row edit or the bulk popover), then recalc once. The override
 * survives future recalcs. Refused on a locked run before any write.
 */
export const overrideOtMultiplier = authActionClient
  .schema(overrideOtMultiplierSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('status')
      .eq('id', parsedInput.run_id)
      .single();
    if (runError) throw new Error(runError.message);
    if (run.status === 'locked')
      throw new Error('This run is locked and can no longer be edited.');

    const { error: updateError } = await supabase
      .from('payslips')
      .update({ overtime_multiplier: parsedInput.overtime_multiplier })
      .eq('payroll_run_id', parsedInput.run_id)
      .in('id', parsedInput.payslip_ids);
    if (updateError) throw new Error(updateError.message);

    const { error: recalcError } = await supabase.rpc('calculate_payroll', {
      p_run_id: parsedInput.run_id,
    });
    if (recalcError) throw new Error(recalcError.message);

    return { run_id: parsedInput.run_id };
  });

/**
 * Set (or clear) an inline overtime-hours override on one payslip, then recalc
 * the run so OT pay, tax and net refresh. Refused on a locked run before any
 * write.
 *
 * Writes the sidecar `overtime_hours_override` column rather than
 * `overtime_hours` itself: the latter is recomputed from the approved overtime
 * logs on every recalc, so a direct write would be wiped by the very recalc
 * below. A `null` clears the override and hands the hours back to those logs.
 */
export const overrideOtHours = authActionClient
  .schema(overrideOtHoursSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: payslip, error: readError } = await supabase
      .from('payslips')
      .select('payroll_run_id, payroll_runs(status)')
      .eq('id', parsedInput.payslip_id)
      .single();
    if (readError) throw new Error(readError.message);
    if (payslip.payroll_runs?.status === 'locked')
      throw new Error('This run is locked and can no longer be edited.');

    const { error: updateError } = await supabase
      .from('payslips')
      .update({ overtime_hours_override: parsedInput.overtime_hours })
      .eq('id', parsedInput.payslip_id);
    if (updateError) throw new Error(updateError.message);

    const { error: recalcError } = await supabase.rpc('calculate_payroll', {
      p_run_id: payslip.payroll_run_id,
    });
    if (recalcError) throw new Error(recalcError.message);

    return { run_id: payslip.payroll_run_id };
  });

/**
 * Append an ad-hoc line item (earning if amount > 0, deduction if < 0) to one or
 * many payslips of a run, then recalc once. Refused on a locked run.
 */
export const addPayslipCustomField = authActionClient
  .schema(addCustomFieldSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('status')
      .eq('id', parsedInput.run_id)
      .single();
    if (runError) throw new Error(runError.message);
    if (run.status === 'locked')
      throw new Error('This run is locked and can no longer be edited.');

    const { data: rows, error: readError } = await supabase
      .from('payslips')
      .select('id, custom_fields')
      .eq('payroll_run_id', parsedInput.run_id)
      .in('id', parsedInput.payslip_ids);
    if (readError) throw new Error(readError.message);

    const field: CustomField = {
      label: parsedInput.label,
      amount: parsedInput.amount,
    };
    const results = await Promise.all(
      (rows ?? []).map((row) =>
        supabase
          .from('payslips')
          .update({
            custom_fields: [...toCustomFields(row.custom_fields), field],
          })
          .eq('id', row.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);

    const { error: recalcError } = await supabase.rpc('calculate_payroll', {
      p_run_id: parsedInput.run_id,
    });
    if (recalcError) throw new Error(recalcError.message);

    return { run_id: parsedInput.run_id };
  });

/**
 * Remove the custom field at `index` of one payslip, then recalc. Refused on a
 * locked run before any write.
 */
export const removePayslipCustomField = authActionClient
  .schema(removeCustomFieldSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    requireAdmin(authUser.user?.app_metadata.role);

    const { data: payslip, error: readError } = await supabase
      .from('payslips')
      .select('payroll_run_id, custom_fields, payroll_runs(status)')
      .eq('id', parsedInput.payslip_id)
      .single();
    if (readError) throw new Error(readError.message);
    if (payslip.payroll_runs?.status === 'locked')
      throw new Error('This run is locked and can no longer be edited.');

    const next = toCustomFields(payslip.custom_fields).filter(
      (_, i) => i !== parsedInput.index,
    );

    const { error: updateError } = await supabase
      .from('payslips')
      .update({ custom_fields: next })
      .eq('id', parsedInput.payslip_id);
    if (updateError) throw new Error(updateError.message);

    const { error: recalcError } = await supabase.rpc('calculate_payroll', {
      p_run_id: payslip.payroll_run_id,
    });
    if (recalcError) throw new Error(recalcError.message);

    return { run_id: payslip.payroll_run_id };
  });
