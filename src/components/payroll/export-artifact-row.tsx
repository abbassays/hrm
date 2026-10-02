'use client';

import { format } from 'date-fns';
import { Download, FileSpreadsheet } from 'lucide-react';

import { type RunExport } from '@/hooks/queries/payroll-exports';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { EXPORT_PROVIDER_LABELS } from '@/constants/payroll-export';

type ExportArtifactRowProps = {
  item: RunExport;
  isDownloading: boolean;
  onDownload: (id: string, filePath: string) => void;
};

export function ExportArtifactRow({
  item,
  isDownloading,
  onDownload,
}: ExportArtifactRowProps) {
  return (
    <li className='flex items-center justify-between gap-3 px-4 py-2.5'>
      <span className='flex min-w-0 items-center gap-2'>
        <FileSpreadsheet className='size-4 shrink-0 text-muted-foreground' />
        <span className='flex min-w-0 flex-col'>
          <span className='flex min-w-0 items-center gap-2'>
            <span className='truncate text-sm font-medium'>
              {item.filePath.split('/').pop()}
            </span>
            <Badge variant='outline' className='shrink-0'>
              {EXPORT_PROVIDER_LABELS[item.provider]}
            </Badge>
          </span>
          <span className='text-xs text-muted-foreground'>
            {format(item.exportedAt, 'd MMM yyyy, h:mm a')}
            {item.exportedByName ? ` · ${item.exportedByName}` : ''}
          </span>
        </span>
      </span>
      <Button
        variant='ghost'
        size='sm'
        iconLeft={Download}
        isLoading={isDownloading}
        disabled={!item.filePath}
        onClick={() => onDownload(item.id, item.filePath)}
      >
        Download
      </Button>
    </li>
  );
}
