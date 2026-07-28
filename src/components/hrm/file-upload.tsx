'use client';

import { FileText, Upload, X } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { formatNumber } from '@/utils/number-functions';

type FileUploadProps = {
  value: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
  /** Passed to the native input, e.g. 'image/png,application/pdf'. */
  accept?: string;
  /** Enforced MIME allow-list (the `accept` attribute alone is only a hint the
   *  user can bypass). Files outside this list are rejected. */
  allowedMimeTypes?: readonly string[];
  /** Overrides the default "Up to N files, XMB each" helper line. */
  hint?: string;
  label?: string;
  disabled?: boolean;
  isLoading?: boolean;
};

export function FileUpload({
  value,
  onChange,
  maxFiles = 5,
  maxSizeMb = 10,
  accept,
  allowedMimeTypes,
  hint,
  label = 'Upload files',
  disabled = false,
  isLoading = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = disabled || isLoading;

  const isAllowedType = (file: File) => {
    if (!allowedMimeTypes?.length) return true;
    if (allowedMimeTypes.includes(file.type)) return true;
    // Some browsers report an empty MIME type — fall back to the extension,
    // matched against the subtype of each allowed MIME (png, pdf, …).
    const ext = file.name.split('.').pop()?.toLowerCase();
    return allowedMimeTypes.some((type) => {
      const subtype = type.split('/')[1];
      return subtype === ext || (subtype === 'jpeg' && ext === 'jpg');
    });
  };

  const handleSelect = (selected: FileList | null) => {
    if (!selected?.length) return;

    const incoming = Array.from(selected);

    const wrongType = incoming.filter((file) => !isAllowedType(file));
    if (wrongType.length) {
      const typeLabel =
        allowedMimeTypes
          ?.map((type) => type.split('/')[1].toUpperCase())
          .join(' or ') ?? 'the allowed file types';
      toast.error(
        `Only ${typeLabel} files are accepted: ${wrongType
          .map((f) => f.name)
          .join(', ')}`,
      );
      return;
    }

    const oversized = incoming.filter(
      (file) => file.size > maxSizeMb * 1024 * 1024,
    );
    if (oversized.length) {
      toast.error(
        `Each file must be under ${maxSizeMb}MB: ${oversized
          .map((f) => f.name)
          .join(', ')}`,
      );
      return;
    }

    const next = [...value, ...incoming];
    if (next.length > maxFiles) {
      toast.error(`You can attach up to ${maxFiles} files.`);
      return;
    }

    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className='flex flex-col gap-2'>
      <input
        ref={inputRef}
        type='file'
        multiple
        accept={accept}
        disabled={isBusy}
        className='sr-only'
        onChange={(e) => {
          handleSelect(e.target.files);
          e.target.value = '';
        }}
      />
      <Button
        type='button'
        variant='outline'
        iconLeft={Upload}
        onClick={() => inputRef.current?.click()}
        disabled={isBusy || value.length >= maxFiles}
        isLoading={isLoading}
      >
        {label}
      </Button>
      <p className='text-xs text-muted-foreground'>
        {hint ?? `Up to ${maxFiles} files, ${maxSizeMb}MB each`}
      </p>
      {value.length > 0 && (
        <ul className='flex flex-col gap-1'>
          {value.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className='flex items-center gap-2 rounded-md border border-border px-3 py-2'
            >
              <FileText
                className='size-4 shrink-0 text-muted-foreground'
                aria-hidden
              />
              <span className='flex-1 truncate text-sm'>{file.name}</span>
              <span className='shrink-0 text-xs text-muted-foreground'>
                {formatNumber(file.size / 1024)} KB
              </span>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7'
                aria-label={`Remove ${file.name}`}
                onClick={() => removeAt(index)}
                disabled={isBusy}
              >
                <X className='size-4' aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
