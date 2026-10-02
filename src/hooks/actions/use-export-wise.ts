'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';

import { exportWise } from '@/actions/payroll-export';

import { onError } from '@/lib/show-error-toast';
import { downloadUrl } from '@/utils/download-functions';

import { QueryKeys } from '@/constants/query-keys';

export function useExportWise(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useAction(exportWise, {
    onSuccess: ({ data }) => {
      if (data?.signed_url) {
        const filename = data.file_path.split('/').pop() ?? 'wise-salaries.csv';
        downloadUrl(data.signed_url, filename);
      }
      queryClient.invalidateQueries({ queryKey: [QueryKeys.RUN_EXPORTS] });
      const count = data?.count ?? 0;
      const excluded = data?.excluded ?? 0;
      // The file downloads either way, so this is the only sign an exclusion took.
      toast.success(
        `Exported ${count} ${count === 1 ? 'payslip' : 'payslips'} for Wise`,
        excluded > 0
          ? { description: `${excluded} excluded from this file.` }
          : undefined,
      );
      onSuccess?.();
    },
    onError,
  });
}
