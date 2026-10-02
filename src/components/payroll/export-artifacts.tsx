'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  createExportSignedUrl,
  useRunExports,
} from '@/hooks/queries/payroll-exports';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';
import { downloadUrl } from '@/utils/download-functions';

import {
  EXPORT_PROVIDER_LABELS,
  EXPORT_PROVIDERS,
  type ExportProvider,
  isExportProvider,
} from '@/constants/payroll-export';

import { ExportArtifactRow } from './export-artifact-row';

const PREVIEW_COUNT = 3;

type ExportArtifactsProps = { runId: string };

export function ExportArtifacts({ runId }: ExportArtifactsProps) {
  const { data: exports, isLoading } = useRunExports(runId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'all' | ExportProvider>('all');
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

  const filtered =
    provider === 'all'
      ? exports
      : exports.filter((item) => item.provider === provider);
  const visible = expanded ? filtered : filtered.slice(0, PREVIEW_COUNT);

  return (
    <div className='rounded-lg border border-border'>
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2'>
        <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Exports
        </p>
        <Tabs
          value={provider}
          onValueChange={(value) => {
            if (value === 'all' || isExportProvider(value)) setProvider(value);
          }}
        >
          <TabsList className='h-8'>
            <TabsTrigger value='all' className='px-2.5 py-1 text-xs'>
              All ({exports.length})
            </TabsTrigger>
            {EXPORT_PROVIDERS.map((option) => (
              <TabsTrigger
                key={option}
                value={option}
                className='px-2.5 py-1 text-xs'
              >
                {EXPORT_PROVIDER_LABELS[option]} (
                {exports.filter((item) => item.provider === option).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <p className='px-4 py-6 text-center text-sm text-muted-foreground'>
          No exports for this provider yet.
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

      {filtered.length > PREVIEW_COUNT && (
        <div className='border-t border-border p-1'>
          <Button
            variant='ghost'
            size='sm'
            className='w-full text-muted-foreground'
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Show fewer' : `Show all ${filtered.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}
