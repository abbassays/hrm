'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { type ConsentInput, consentSchema } from '@/schema/onboarding';

type ConsentStepProps = {
  onSubmit: (values: ConsentInput) => Promise<void>;
  onBack: () => void;
};

export function ConsentStep({ onSubmit, onBack }: ConsentStepProps) {
  const form = useForm<ConsentInput>({
    resolver: zodResolver(consentSchema),
    // reason: zod infers consent as literal `true`; the unchecked initial state is undefined, not false
    defaultValues: { consent: undefined as unknown as true },
  });

  const consented = form.watch('consent') === true;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-6'
      >
        <p className='text-sm text-muted-foreground'>
          Check your details in the previous steps, then confirm below to
          complete your onboarding.
        </p>
        <FormField
          control={form.control}
          name='consent'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-start gap-3 rounded-lg border border-border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true ? true : undefined)
                    }
                  />
                </FormControl>
                <FormLabel className='text-sm font-normal leading-relaxed'>
                  I confirm the information provided is accurate, and I consent
                  to Bitsmiths processing this data for employment and HR
                  purposes.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className='flex justify-between'>
          <Button type='button' variant='outline' onClick={onBack}>
            Back
          </Button>
          <Button
            type='submit'
            disabled={!consented}
            isLoading={form.formState.isSubmitting}
          >
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
}
