'use client';

import { type FormEventHandler } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { WISE_REFERENCE_MAX_LENGTH } from '@/constants/payroll-export';
import { type WiseReferenceInput } from '@/schema/payroll-export';

type WiseReferenceFormProps = {
  form: UseFormReturn<WiseReferenceInput>;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

export function WiseReferenceForm({ form, onSubmit }: WiseReferenceFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name='paymentReference'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment reference</FormLabel>
              <FormControl>
                <Input maxLength={WISE_REFERENCE_MAX_LENGTH} {...field} />
              </FormControl>
              <FormDescription>
                Sent with every transfer in this file.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
