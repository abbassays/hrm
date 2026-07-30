'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { socialAccountsFields } from '@/constants/onboarding';
import {
  type SocialAccountsInput,
  socialAccountsSchema,
} from '@/schema/onboarding';

type SocialAccountsStepProps = {
  defaultValues: SocialAccountsInput;
  onNext: (values: SocialAccountsInput) => void | Promise<void>;
  onBack: () => void;
};

export function SocialAccountsStep({
  defaultValues,
  onNext,
  onBack,
}: SocialAccountsStepProps) {
  const form = useForm<SocialAccountsInput>({
    resolver: zodResolver(socialAccountsSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onNext)}
        className='flex flex-col gap-4'
      >
        {socialAccountsFields.map(({ name, label, placeholder }) => {
          const isRequired = name === 'github';

          return (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {label}
                    {isRequired && (
                      <span className='ml-0.5 text-destructive' aria-hidden>
                        *
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={placeholder}
                      required={isRequired}
                      aria-required={isRequired}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
        <div className='flex justify-between'>
          <Button type='button' variant='outline' onClick={onBack}>
            Back
          </Button>
          <Button type='submit' isLoading={form.formState.isSubmitting}>
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
