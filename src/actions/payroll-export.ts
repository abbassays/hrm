'use server';

import {
  PAYONEER_CSV_MIME,
  PAYONEER_HEADER,
  payoneerFileName,
  toCsv,
} from '@/lib/payroll/payoneer-csv';
import { authActionClient } from '@/lib/server/safe-action';
import { supabaseAdmin } from '@/lib/supabase/admin';

import { exportPayoneerSchema } from '@/schema/payroll-export';

import type { Tables } from '@/types/supabase';

const EXPORTS_BUCKET = 'payroll-exports';
/** Short TTL — the URL is only used for the immediate post-export download; the
 *  history view mints its own fresh signed URLs on demand. */
const DOWNLOAD_TTL_SECONDS = 60 * 5;

/** One run payslip with the employee name joined (via the `payslips → employees`
 *  FK). Declared explicitly so `rows` reads as a checked annotation — supabase-js
 *  infers a shape assignable to this, so no `as` cast is needed. */
type ExportPayslipRow = Pick<
  Tables<'payslips'>,
  'employee_id' | 'total_pay'
> & {
  employees: Pick<Tables<'employees'>, 'full_name'> | null;
};

/**
 * Build and persist the Payoneer bulk-payment CSV for a *locked* run.
 *
 * Locked-only at two layers: the employee payslip view relies on the RLS
 * `payslip_own_locked` gate; this action adds its own explicit `status` refuse
 * because it reads via the service-role client (which bypasses RLS entirely).
 *
 * Bank details are read cross-employee through `supabaseAdmin` — the action's
 * own `role === 'admin'` guard is the access control here, not RLS. Amounts are
 * the frozen `payslips.total_pay` snapshot (recipient PKR); the engine is never
 * re-run. A missing IBAN is a hard, per-employee error: we validate every
 * *included* row before writing anything, so a bad row records no currency, no
 * file, no row — while `excludedEmployeeIds` is the escape hatch that lets the
 * rest of the run go out without them.
 */
export const exportPayoneer = authActionClient
  .schema(exportPayoneerSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    if (authUser.user?.app_metadata.role !== 'admin')
      throw new Error('Forbidden');

    const { run_id, currencyByEmployee, excludedEmployeeIds } = parsedInput;

    // Locked-only gate (via the caller's RLS-scoped client). `period_month`
    // names the file after the month it pays.
    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('id, status, period_month')
      .eq('id', run_id)
      .single();
    if (runError) throw new Error(runError.message);
    if (run.status !== 'locked')
      throw new Error('Run must be locked before export.');

    // Cross-employee reads need the service-role client. bank_details is fetched
    // separately (keyed by employee_id) rather than embedded off payslips —
    // there is no direct payslips → bank_details FK for PostgREST to follow.
    const { data: payslipData, error: payslipError } = await supabaseAdmin
      .from('payslips')
      .select('employee_id, total_pay, employees(full_name)')
      .eq('payroll_run_id', run_id);
    if (payslipError) throw new Error(payslipError.message);

    const allRows: ExportPayslipRow[] = payslipData ?? [];
    if (allRows.length === 0)
      throw new Error('This run has no payslips to export.');

    // Everything downstream — validation, the currency stamp, the file — works
    // off the included set only. That is what lets one person's missing IBAN be
    // worked around by excluding them rather than blocking the whole run.
    const excluded = new Set(excludedEmployeeIds);
    const rows = allRows.filter((row) => !excluded.has(row.employee_id));
    if (rows.length === 0)
      throw new Error(
        'Every employee is excluded — include at least one to export.',
      );

    const { data: bankData, error: bankError } = await supabaseAdmin
      .from('bank_details')
      .select('employee_id, account_holder, iban')
      .in(
        'employee_id',
        rows.map((row) => row.employee_id),
      );
    if (bankError) throw new Error(bankError.message);
    const bankByEmployee = new Map(
      (bankData ?? []).map((bank) => [bank.employee_id, bank]),
    );

    // Validate EVERY row first (missing currency / IBAN → hard error, no writes).
    const dataRows: (string | number)[][] = [];
    for (const row of rows) {
      const name = row.employees?.full_name ?? row.employee_id;
      const source = currencyByEmployee[row.employee_id];
      const bank = bankByEmployee.get(row.employee_id);
      if (!source) throw new Error(`Choose a source currency for ${name}.`);
      if (!bank?.iban)
        throw new Error(
          `Missing IBAN for ${name}. Add their bank details before exporting.`,
        );
      dataRows.push([
        bank.account_holder ?? name, // Bank Account Holder Name
        bank.iban, // Bank Account Number/IBAN
        source, // Payoneer Balance to Pay From
        '', // Amount to Pay (Payoneer derives from balance + FX)
        row.total_pay, // Amount Recipient Gets (whole PKR)
        'PKR', // Recipient Bank Account Currency (fixed)
        '', // Payment Reference (Optional)
        '', // Transaction Description (Optional)
      ]);
    }

    // Persist the chosen source currency onto each snapshot (one UPDATE per
    // distinct currency, run concurrently). Only reached once every row
    // validated, so a bad row never leaves a partial write behind.
    const employeesByCurrency = new Map<string, string[]>();
    for (const row of rows) {
      const source = currencyByEmployee[row.employee_id];
      employeesByCurrency.set(source, [
        ...(employeesByCurrency.get(source) ?? []),
        row.employee_id,
      ]);
    }
    const updates = await Promise.all(
      [...employeesByCurrency].map(([source, employeeIds]) =>
        supabaseAdmin
          .from('payslips')
          .update({ currency_balance: source })
          .eq('payroll_run_id', run_id)
          .in('employee_id', employeeIds),
      ),
    );
    const failedUpdate = updates.find((result) => result.error);
    if (failedUpdate?.error) throw new Error(failedUpdate.error.message);

    // Build the CSV from an array-of-arrays so column order === the header.
    const csv = toCsv([[...PAYONEER_HEADER], ...dataRows]);

    // Keep the payroll-month filename readable. Existing artifacts for this run
    // claim the next Word-style copy suffix instead of putting a timestamp in
    // every export name.
    const { data: existingFiles, error: listError } =
      await supabaseAdmin.storage
        .from(EXPORTS_BUCKET)
        .list(run_id, { limit: 1000 });
    if (listError) throw new Error(listError.message);

    const existingNames = new Set(
      (existingFiles ?? []).map((file) => file.name),
    );
    let copyNumber = 0;
    while (existingNames.has(payoneerFileName(run.period_month, copyNumber))) {
      copyNumber += 1;
    }

    const filePath = `${run_id}/${payoneerFileName(run.period_month, copyNumber)}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(EXPORTS_BUCKET)
      .upload(filePath, Buffer.from(csv, 'utf8'), {
        contentType: PAYONEER_CSV_MIME,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    // Record the artifact (via the RLS-scoped client — proves an admin session).
    const { error: insertError } = await supabase
      .from('payroll_exports')
      .insert({
        run_id,
        exported_by: authUser.user?.id,
        file_path: filePath,
      });
    if (insertError) throw new Error(insertError.message);

    const { data: signed } = await supabaseAdmin.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(filePath, DOWNLOAD_TTL_SECONDS);

    return {
      file_path: filePath,
      signed_url: signed?.signedUrl ?? null,
      count: dataRows.length,
      excluded: allRows.length - rows.length,
    };
  });
