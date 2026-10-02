import { type User } from '@supabase/supabase-js';
import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { type createSupabaseServerClient } from '@/lib/supabase/server';

import { type ExportProvider } from '@/constants/payroll-export';

import { CSV_MIME } from './csv';

import type { Tables, TablesUpdate } from '@/types/supabase';

const EXPORTS_BUCKET = 'payroll-exports';
const DOWNLOAD_TTL_SECONDS = 60 * 5;

type ExportContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  authUser: { user: User | null };
};

type ExportSelection = {
  run_id: string;
  currencyByEmployee: Record<string, string>;
  excludedEmployeeIds: string[];
};

type ExportRun = Pick<Tables<'payroll_runs'>, 'id' | 'period_month'>;

type ExportPayslipRow = Pick<
  Tables<'payslips'>,
  'employee_id' | 'total_pay'
> & {
  employees: Pick<Tables<'employees'>, 'full_name' | 'email'> | null;
};

export type ExportPayee = {
  employeeId: string;
  holderName: string;
  email: string;
  iban: string;
  sourceCurrency: string;
  amount: number;
};

export async function loadExportPayees(
  { supabase, authUser }: ExportContext,
  { run_id, currencyByEmployee, excludedEmployeeIds }: ExportSelection,
) {
  if (authUser.user?.app_metadata.role !== 'admin')
    throw new Error('Forbidden');

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .select('id, status, period_month')
    .eq('id', run_id)
    .single();
  if (runError) throw new Error(runError.message);
  if (run.status !== 'locked')
    throw new Error('Run must be locked before export.');

  // There is no payslips → bank_details FK for PostgREST to embed.
  const { data: payslipData, error: payslipError } = await supabaseAdmin
    .from('payslips')
    .select('employee_id, total_pay, employees(full_name, email)')
    .eq('payroll_run_id', run_id);
  if (payslipError) throw new Error(payslipError.message);

  const allRows: ExportPayslipRow[] = payslipData ?? [];
  if (allRows.length === 0)
    throw new Error('This run has no payslips to export.');

  // Excluding first lets one person's missing IBAN be worked around.
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

  // Validated before any write, so a bad row leaves nothing behind.
  const payees: ExportPayee[] = rows.map((row) => {
    const name = row.employees?.full_name ?? row.employee_id;
    const sourceCurrency = currencyByEmployee[row.employee_id];
    const bank = bankByEmployee.get(row.employee_id);
    if (!sourceCurrency)
      throw new Error(`Choose a source currency for ${name}.`);
    if (!bank?.iban)
      throw new Error(
        `Missing IBAN for ${name}. Add their bank details before exporting.`,
      );
    return {
      employeeId: row.employee_id,
      holderName: bank.account_holder ?? name,
      email: row.employees?.email ?? '',
      iban: bank.iban,
      sourceCurrency,
      amount: row.total_pay,
    };
  });

  return { run, payees, excluded: allRows.length - rows.length };
}

// Wise keeps its own column so a re-export can't rewrite Payoneer history.
const sourceCurrencyPatch = (
  provider: ExportProvider,
  sourceCurrency: string,
): TablesUpdate<'payslips'> =>
  provider === 'wise'
    ? { wise_source_currency: sourceCurrency }
    : { currency_balance: sourceCurrency };

export async function saveSourceCurrencies(
  provider: ExportProvider,
  runId: string,
  payees: ExportPayee[],
) {
  const employeesByCurrency = new Map<string, string[]>();
  for (const payee of payees) {
    employeesByCurrency.set(payee.sourceCurrency, [
      ...(employeesByCurrency.get(payee.sourceCurrency) ?? []),
      payee.employeeId,
    ]);
  }
  const updates = await Promise.all(
    [...employeesByCurrency].map(([sourceCurrency, employeeIds]) =>
      supabaseAdmin
        .from('payslips')
        .update(sourceCurrencyPatch(provider, sourceCurrency))
        .eq('payroll_run_id', runId)
        .in('employee_id', employeeIds),
    ),
  );
  const failedUpdate = updates.find((result) => result.error);
  if (failedUpdate?.error) throw new Error(failedUpdate.error.message);
}

type ExportFile = {
  provider: ExportProvider;
  run: ExportRun;
  csv: string;
  fileName: (periodMonth: string, copyNumber: number) => string;
};

export async function storeExportFile(
  { supabase, authUser }: ExportContext,
  { provider, run, csv, fileName }: ExportFile,
) {
  const { data: existingFiles, error: listError } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .list(run.id, { limit: 1000 });
  if (listError) throw new Error(listError.message);

  // Re-exports take the next copy suffix instead of a timestamp in every name.
  const existingNames = new Set((existingFiles ?? []).map((file) => file.name));
  let copyNumber = 0;
  while (existingNames.has(fileName(run.period_month, copyNumber))) {
    copyNumber += 1;
  }

  const filePath = `${run.id}/${fileName(run.period_month, copyNumber)}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .upload(filePath, Buffer.from(csv, 'utf8'), {
      contentType: CSV_MIME,
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  // Recorded via the RLS-scoped client, which proves an admin session.
  const { error: insertError } = await supabase.from('payroll_exports').insert({
    run_id: run.id,
    exported_by: authUser.user?.id,
    file_path: filePath,
    provider,
  });
  if (insertError) throw new Error(insertError.message);

  const { data: signed } = await supabaseAdmin.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(filePath, DOWNLOAD_TTL_SECONDS);

  return { file_path: filePath, signed_url: signed?.signedUrl ?? null };
}
