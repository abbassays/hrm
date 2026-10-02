'use client';

import { endOfDay, isWithinInterval, startOfDay } from 'date-fns';
import { useState } from 'react';
import { type DateRange } from 'react-day-picker';
import { toast } from 'sonner';

import {
  createExportSignedUrl,
  useRunExports,
} from '@/hooks/queries/payroll-exports';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';
import { downloadUrl } from '@/utils/download-functions';

import { type ExportProviderFilter } from '@/constants/payroll-export';

import { ExportArtifactRow } from './export-artifact-row';
import { ExportArtifactsToolbar } from './export-artifacts-toolbar';

const PREVIEW_COUNT = 3;

type ExportArtifactsProps = { runId: string };

export function ExportArtifacts({ runId }: ExportArtifactsProps) {
  const { data: exports, isLoading } = useRunExports(runId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ExportProviderFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>();
  const [newestFirst, setNewestFirst] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const handleDownload = async (id: string, filePath: string) => {
    setDownloadingId(id);
    try {
      const url = await createExportSignedUrl(filePath);
      downloadUrl(url, filePath.split('/').pop() ?? 'salaries.csv');
    } catch (error) {
      toast.error('Could not open export', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) return <Skeleton className='h-16 rounded-lg' />;
  if (!exports?.length) return null;

  const from = dateRange?.from;
  const inDateRange = from
    ? exports.filter((item) =>
        isWithinInterval(item.exportedAt, {
          start: startOfDay(from),
          end: endOfDay(dateRange.to ?? from),
        }),
      )
    : exports;
  const filtered =
    provider === 'all'
      ? inDateRange
      : inDateRange.filter((item) => item.provider === provider);
  // The query returns newest first.
  const ordered = newestFirst ? filtered : [...filtered].reverse();
  const visible = expanded ? ordered : ordered.slice(0, PREVIEW_COUNT);

  return (
    <div className='rounded-lg border border-border'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2'>
        <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Exports
        </p>
        <ExportArtifactsToolbar
          exports={inDateRange}
          provider={provider}
          onProviderChange={setProvider}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          newestFirst={newestFirst}
          onToggleSort={() => setNewestFirst((prev) => !prev)}
        />
      </div>

      {ordered.length === 0 ? (
        <p className='px-4 py-6 text-center text-sm text-muted-foreground'>
          No exports match these filters.
        </p>
      ) : (
        <ul
          className={cn(
            'divide-y divide-border',
            expanded && 'max-h-80 overflow-y-auto',
          )}
        >
          {visible.map((item) => (
            <ExportArtifactRow
              key={item.id}
              item={item}
              isDownloading={downloadingId === item.id}
              onDownload={handleDownload}
            />
          ))}
        </ul>
      )}

      {ordered.length > PREVIEW_COUNT && (
        <div className='border-t border-border p-1'>
          <Button
            variant='ghost'
            size='sm'
            className='w-full text-muted-foreground'
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Show fewer' : `Show all ${ordered.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}
