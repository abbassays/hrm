'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { updatePassword } from '@/actions/auth';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { ControlledPasswordInput } from '@/components/ui/form/controlled-password-input';

import { onError } from '@/lib/show-error-toast';

import { paths } from '@/constants/paths';
import { type ResetPasswordInput, resetPasswordSchema } from '@/schema/auth';

/** Reached from the emailed recovery link once the reset page has established a
 *  recovery session (the `token_hash` is exchanged by `RecoveryTokenVerifier`).
 *  The user is in a recovery session here and sets a new password. */
export function ResetPasswordForm() {
  const router = useRouter();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const { execute, isPending } = useAction(updatePassword, {
    onSuccess: () => {
      toast.success('Password updated — sign in with your new password.');
      router.push(paths.auth.login);
    },
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>
          Set a new password
        </CardTitle>
        <CardDescription>
          Choose a new password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(execute)}
            className='flex flex-col gap-4'
          >
            <ControlledPasswordInput<ResetPasswordInput>
              name='password'
              label='New password'
              autoComplete='new-password'
              placeholder='••••••••'
            />
            <ControlledPasswordInput<ResetPasswordInput>
              name='confirmPassword'
              label='Confirm password'
              autoComplete='new-password'
              placeholder='••••••••'
              hideInstructions
            />
            <Button type='submit' isLoading={isPending}>
              Update password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
