'use client';

import { type FormEventHandler } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ControlledSelect } from '@/components/ui/form/controlled-select';
import { Input } from '@/components/ui/input';

import {
  BALANCE_CURRENCIES,
  WISE_REFERENCE_MAX_LENGTH,
} from '@/constants/payroll-export';
import { type WiseFileInput } from '@/schema/payroll-export';

type WiseFileFormProps = {
  form: UseFormReturn<WiseFileInput>;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function WiseFileForm({ form, onSubmit }: WiseFileFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <div className='grid items-start gap-4 sm:grid-cols-[10rem_1fr]'>
          <ControlledSelect<WiseFileInput>
            name='sourceCurrency'
            label='Pay from'
            options={[...BALANCE_CURRENCIES]}
          />
          <FormField
            control={form.control}
            name='paymentReference'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment reference</FormLabel>
                <FormControl>
                  <Input maxLength={WISE_REFERENCE_MAX_LENGTH} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
