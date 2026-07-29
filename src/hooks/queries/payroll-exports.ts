import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { authQuery } from '@/lib/client/auth-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { QueryKeys } from '@/constants/query-keys';

import { type Tables } from '@/types/supabase';

/** Private bucket holding Payoneer files at `<run_id>/salaries-mon-year.csv`. */
export const PAYROLL_EXPORTS_BUCKET = 'payroll-exports';
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5m — long enough to click through to a download

export type RunExport = {
  id: string;
  filePath: string;
  exportedAt: string;
  /** Joined via the `exported_by → employees` FK; '' when the row predates it. */
  exportedByName: string;
};

type RunExportRow = Tables<'payroll_exports'> & {
  employees?: Pick<Tables<'employees'>, 'full_name'> | null;
};

// A run's export artifacts, newest first. RLS (`exports_admin`) already scopes
// this to admins — an employee reading it gets nothing. Drives the download
// links on the locked drill-down.
const fetchRunExports = authQuery(
  async ({ supabase, params }) => {
    const { data, error } = await supabase
      .from('payroll_exports')
      .select('*, employees(full_name)')
      .eq('run_id', params.runId)
      .order('exported_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RunExportRow[]).map((row) => ({
      id: row.id,
      filePath: row.file_path ?? '',
      exportedAt: row.exported_at,
      exportedByName: row.employees?.full_name ?? '',
    }));
  },
  { paramsSchema: z.object({ runId: z.string() }) },
);

/** Export artifacts for one run (admin history drill-down). */
export const useRunExports = (runId?: string) =>
  useQuery({
    queryKey: [QueryKeys.RUN_EXPORTS, runId],
    queryFn: () => fetchRunExports({ runId: runId! }),
    enabled: !!runId,
  });

/** Mint a short-lived signed URL for one stored export file. Gated by the
 *  `payroll_exports_admin` storage policy (admins only). Used on click, so the
 *  URL is always fresh when the download starts. */
export async function createExportSignedUrl(filePath: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(PAYROLL_EXPORTS_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
