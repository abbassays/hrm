'use client';

import { FieldPath, FieldValues, useFormContext } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

import { cn } from '@/lib/utils';

type ControlledSelectProps<TFieldValues extends FieldValues> = {
  options:
    | string[]
    | {
        label: string;
        value: string;
        disabled?: boolean;
      }[];
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  name: FieldPath<TFieldValues>;
  label?: string;
};

function isLabelValueOptions(
  options: string[] | { label: string; value: string; disabled?: boolean }[],
): options is { label: string; value: string; disabled?: boolean }[] {
  // An empty array isn't a label/value list (there's no non-string element to
  // key on), so it falls through to the raw-value branch rather than a doomed
  // .find() that always returns undefined.
  return options.length > 0 && typeof options[0] !== 'string';
}

export function ControlledSelect<TFieldValues extends FieldValues>({
  options,
  placeholder,
  className,
  name,
  containerClassName,
  label,
}: ControlledSelectProps<TFieldValues>) {
  const form = useFormContext<TFieldValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('', containerClassName)}>
          <Select
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
            }}
          >
            {!!label && <FormLabel>{label}</FormLabel>}
            <FormControl>
              <SelectTrigger
                className={cn(
                  // Match Input's focus treatment: no ring on pointer/auto
                  // focus (kills the leftover ring-offset that showed as corner
                  // marks when the dialog auto-focuses the trigger), clean ring
                  // on keyboard focus only.
                  'w-full gap-2.5 focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-w-28',
                  className,
                )}
              >
                <p
                  className='truncate text-sm'
                  title={
                    field.value
                      ? isLabelValueOptions(options)
                        ? options.find((o) => o.value === field.value)?.label
                        : field.value
                      : undefined
                  }
                >
                  {field.value ? (
                    isLabelValueOptions(options) ? (
                      options.find((o) => o.value === field.value)?.label
                    ) : (
                      field.value
                    )
                  ) : (
                    <span className='text-neutral-400'>{placeholder}</span>
                  )}
                </p>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option, idx) => {
                if (typeof option === 'string')
                  return (
                    <SelectItem key={idx} value={option}>
                      {option}
                    </SelectItem>
                  );
                else
                  return (
                    <SelectItem
                      key={idx}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </SelectItem>
                  );
              })}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
