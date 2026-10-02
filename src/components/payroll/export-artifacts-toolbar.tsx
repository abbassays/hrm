'use client';

import { format, isSameDay } from 'date-fns';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarIcon,
} from 'lucide-react';
import { type DateRange } from 'react-day-picker';

import { type RunExport } from '@/hooks/queries/payroll-exports';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  EXPORT_PROVIDER_LABELS,
  EXPORT_PROVIDERS,
  type ExportProviderFilter,
  isExportProvider,
} from '@/constants/payroll-export';

type ExportArtifactsToolbarProps = {
  exports: RunExport[];
  provider: ExportProviderFilter;
  onProviderChange: (provider: ExportProviderFilter) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  newestFirst: boolean;
  onToggleSort: () => void;
};

const dateRangeLabel = (range: DateRange | undefined) => {
  if (!range?.from) return 'Any date';
  if (!range.to || isSameDay(range.from, range.to))
    return format(range.from, 'd MMM yyyy');
  return `${format(range.from, 'd MMM')} – ${format(range.to, 'd MMM yyyy')}`;
};

export function ExportArtifactsToolbar({
  exports,
  provider,
  onProviderChange,
  dateRange,
  onDateRangeChange,
  newestFirst,
  onToggleSort,
}: ExportArtifactsToolbarProps) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Tabs
        value={provider}
        onValueChange={(value) => {
          if (value === 'all' || isExportProvider(value))
            onProviderChange(value);
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            iconLeft={CalendarIcon}
            className='h-8 text-xs font-normal'
          >
            {dateRangeLabel(dateRange)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='end'>
          <Calendar
            mode='range'
            selected={dateRange}
            onSelect={onDateRangeChange}
            defaultMonth={dateRange?.from}
            disabled={{ after: new Date() }}
            autoFocus
          />
          {dateRange?.from && (
            <div className='border-t border-border p-1'>
              <Button
                variant='ghost'
                size='sm'
                className='w-full text-muted-foreground'
                onClick={() => onDateRangeChange(undefined)}
              >
                Clear dates
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant='ghost'
        size='sm'
        iconLeft={newestFirst ? ArrowDownWideNarrow : ArrowUpNarrowWide}
        className='h-8 text-xs font-normal text-muted-foreground'
        onClick={onToggleSort}
      >
        {newestFirst ? 'Newest first' : 'Oldest first'}
      </Button>
    </div>
  );
}
