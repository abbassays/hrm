'use client';

import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { WISE_EXPORT_NOTES } from '@/constants/payroll-export';

export function WiseExportInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-7 text-muted-foreground'
          aria-label='How the Wise export works'
        >
          <Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80'>
        <p className='mb-2 text-sm font-medium'>How the Wise export works</p>
        <ul className='flex list-disc flex-col gap-2 pl-4 text-sm font-normal text-muted-foreground'>
          {WISE_EXPORT_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
