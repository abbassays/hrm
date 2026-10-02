'use server';

import { CSV_MIME, toCsv } from '@/lib/payroll/csv';
import { PAYONEER_HEADER, payoneerFileName } from '@/lib/payroll/payoneer-csv';
import { authActionClient } from '@/lib/server/safe-action';
import { supabaseAdmin } from '@/lib/supabase/admin';

import { exportPayoneerSchema } from '@/schema/payroll-export';

import type { Tables } from '@/types/supabase';

const EXPORTS_BUCKET = 'payroll-exports';
const DOWNLOAD_TTL_SECONDS = 60 * 5;

type ExportPayslipRow = Pick<
  Tables<'payslips'>,
  'employee_id' | 'total_pay'
> & {
  employees: Pick<Tables<'employees'>, 'full_name'> | null;
};

export const exportPayoneer = authActionClient
  .schema(exportPayoneerSchema)
  .action(async ({ parsedInput, ctx: { supabase, authUser } }) => {
    if (authUser.user?.app_metadata.role !== 'admin')
      throw new Error('Forbidden');

    const { run_id, currencyByEmployee, excludedEmployeeIds } = parsedInput;

    // `period_month` also names the file after the month it pays.
    const { data: run, error: runError } = await supabase
      .from('payroll_runs')
      .select('id, status, period_month')
      .eq('id', run_id)
      .single();
    if (runError) throw new Error(runError.message);
    if (run.status !== 'locked')
      throw new Error('Run must be locked before export.');

    // `bank_details` is fetched separately below rather than embedded: there is
    // no direct payslips → bank_details FK for PostgREST to follow.
    const { data: payslipData, error: payslipError } = await supabaseAdmin
      .from('payslips')
      .select('employee_id, total_pay, employees(full_name)')
      .eq('payroll_run_id', run_id);
    if (payslipError) throw new Error(payslipError.message);

    const allRows: ExportPayslipRow[] = payslipData ?? [];
    if (allRows.length === 0)
      throw new Error('This run has no payslips to export.');

    // Everything downstream works off the included set only, so one person's
    // missing IBAN can be worked around instead of blocking the run.
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

    // Validate every row before any write, so a bad row leaves nothing behind.
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

    // One update per distinct currency, run concurrently.
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

    // Array-of-arrays keeps column order identical to the header.
    const csv = toCsv([[...PAYONEER_HEADER], ...dataRows]);

    // Re-exports take the next copy suffix, keeping a readable month-named file
    // instead of a timestamp in every name.
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
        contentType: CSV_MIME,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    // Recorded via the RLS-scoped client, which proves an admin session.
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
