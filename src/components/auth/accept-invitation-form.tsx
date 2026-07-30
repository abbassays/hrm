'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { acceptInvite } from '@/actions/onboarding';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form, FormItem, FormLabel } from '@/components/ui/form';
import { ControlledPasswordInput } from '@/components/ui/form/controlled-password-input';
import { Input } from '@/components/ui/input';

import { onError } from '@/lib/show-error-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { paths } from '@/constants/paths';
import {
  type AcceptInvitationInput,
  acceptInvitationSchema,
} from '@/schema/auth';

type AcceptInvitationFormProps = {
  /** Read from the invite session on the server; shown read-only here. */
  email: string;
};

/** Landing screen for the emailed invitation link (PRD 4.2.2): the employee
 *  sets a password — which signs them in — then advances invited → onboarding
 *  and is routed straight into the onboarding wizard. There is no review gate
 *  or waiting screen in between. */
export function AcceptInvitationForm({ email }: AcceptInvitationFormProps) {
  const router = useRouter();

  const form = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const { execute, isPending } = useAction(acceptInvite, {
    onSuccess: async () => {
      // Refresh the JWT after the acceptance RPC updates account_status in Auth
      // metadata, before middleware evaluates the destination route.
      await createSupabaseBrowserClient().auth.refreshSession();
      toast.success('Account created — let’s complete your onboarding');
      router.push(paths.employee.onboarding);
      router.refresh();
    },
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Welcome to Bitsmiths
        </CardTitle>
        <CardDescription>
          Set a password to activate your account, then complete onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(execute)}
            className='flex flex-col gap-4'
          >
            <FormItem>
              <FormLabel>Email</FormLabel>
              <Input value={email} disabled readOnly />
            </FormItem>
            <ControlledPasswordInput<AcceptInvitationInput>
              name='password'
              label='Password'
              autoComplete='new-password'
              placeholder='••••••••'
            />
            <ControlledPasswordInput<AcceptInvitationInput>
              name='confirmPassword'
              label='Confirm password'
              autoComplete='new-password'
              placeholder='••••••••'
              hideInstructions
            />
            <Button type='submit' isLoading={isPending}>
              Create account & start onboarding
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
