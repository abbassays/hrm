'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { requestPasswordReset } from '@/actions/auth';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { onError } from '@/lib/show-error-toast';

import { paths } from '@/constants/paths';
import { type ForgotPasswordInput, forgotPasswordSchema } from '@/schema/auth';

type Screen = 'form' | 'sent' | 'not_found' | 'disabled';

export function ForgotPasswordForm() {
  // Which of the three screens is showing, and the address to echo back on the
  // result cards. `screen` is driven by the action's returned status.
  const [screen, setScreen] = useState<Screen>('form');
  const [email, setEmail] = useState('');

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const { execute, isPending } = useAction(requestPasswordReset, {
    onSuccess: ({ data }) => {
      setScreen(data?.status ?? 'sent');
    },
    onError,
  });

  const onSubmit = (values: ForgotPasswordInput) => {
    setEmail(values.email);
    execute(values);
  };

  const backToForm = () => {
    form.reset();
    setScreen('form');
  };

  // Reset link sent.
  if (screen === 'sent') {
    return (
      <Card>
        <CardHeader className='items-center text-center'>
          <MailCheck className='size-8 text-primary' aria-hidden />
          <CardTitle className='text-xl font-semibold'>
            Reset link sent
          </CardTitle>
          <CardDescription>
            We&apos;ve sent a password reset link to{' '}
            <span className='font-medium text-foreground'>{email}</span>. It can
            take a minute to arrive — remember to check your spam folder.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <Link href={paths.auth.login} className='w-full'>
            <Button className='w-full'>Back to sign in</Button>
          </Link>
          <Button type='button' variant='ghost' onClick={backToForm}>
            Use a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No account for that address.
  if (screen === 'not_found') {
    return (
      <Card>
        <CardHeader className='items-center text-center'>
          <UserX className='size-8 text-muted-foreground' aria-hidden />
          <CardTitle className='text-xl font-semibold'>
            No account found
          </CardTitle>
          <CardDescription>
            We couldn&apos;t find an account for{' '}
            <span className='font-medium text-foreground'>{email}</span>.
            Double-check the address, or contact your admin if you think this is
            a mistake.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <Button type='button' onClick={backToForm}>
            Try a different email
          </Button>
          <Link href={paths.auth.login} className='w-full'>
            <Button variant='ghost' className='w-full'>
              Back to sign in
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // A deliberately disabled account has no password-recovery path until an
  // administrator restores its access.
  if (screen === 'disabled') {
    return (
      <Card>
        <CardHeader className='items-center text-center'>
          <UserX className='size-8 text-destructive' aria-hidden />
          <CardTitle className='text-xl font-semibold'>Account disabled</CardTitle>
          <CardDescription>
            This account has been disabled and can no longer be accessed. Please
            contact your administrator if you think this is a mistake.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <Link href={paths.auth.login} className='w-full'>
            <Button className='w-full'>Back to sign in</Button>
          </Link>
          <Button type='button' variant='ghost' onClick={backToForm}>
            Use a different email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl font-semibold'>Reset password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='you@bitsmiths.studio'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type='submit' isLoading={isPending}>
              Send reset link
            </Button>
            <Link
              href={paths.auth.login}
              className='text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
            >
              Back to sign in
            </Link>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
