'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { type IconType } from 'react-icons/lib';
import { SiPayoneer, SiWise } from 'react-icons/si';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  EXPORT_PROVIDER_HINTS,
  EXPORT_PROVIDER_LABELS,
  EXPORT_PROVIDERS,
  type ExportProvider,
} from '@/constants/payroll-export';

const PROVIDER_ICONS: Record<ExportProvider, IconType> = {
  wise: SiWise,
  payoneer: SiPayoneer,
};

type ExportProviderDialogProps = {
  disabled?: boolean;
  onSelect: (provider: ExportProvider) => void;
};

export function ExportProviderDialog({
  disabled,
  onSelect,
}: ExportProviderDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (provider: ExportProvider) => {
    setOpen(false);
    onSelect(provider);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' iconLeft={Download} disabled={disabled}>
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Export salaries</DialogTitle>
          <DialogDescription>
            Choose who you&apos;re paying through. You&apos;ll review the file
            next.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-3 sm:grid-cols-2'>
          {EXPORT_PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            return (
              <Button
                key={provider}
                variant='outline'
                className='h-auto flex-col items-start gap-2 whitespace-normal p-4 text-left [&_svg]:size-6'
                onClick={() => handleSelect(provider)}
              >
                <Icon />
                <span className='text-base font-semibold'>
                  {EXPORT_PROVIDER_LABELS[provider]}
                </span>
                <span className='text-sm font-normal text-muted-foreground'>
                  {EXPORT_PROVIDER_HINTS[provider]}
                </span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
