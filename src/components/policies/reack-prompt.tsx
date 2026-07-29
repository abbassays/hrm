'use client';

import { Megaphone } from 'lucide-react';
import Link from 'next/link';

import { usePendingAcknowledgments } from '@/hooks/queries/policies';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { paths } from '@/constants/paths';

/**
 * A simple employee dashboard banner for outstanding policy acknowledgments.
 * It remains visible until the employee completes the outstanding reviews.
 */
export function ReackPrompt() {
  const { data: pending, isLoading } = usePendingAcknowledgments();

  if (isLoading) return <Skeleton className='h-24 rounded-xl' />;

  if (!pending.length) {
    return null;
  }

  return (
    <Card className='border-amber-500/40 bg-amber-500/5'>
      <CardContent className='flex items-center justify-between gap-3 p-4'>
        <div className='flex items-start gap-3'>
          <Megaphone
            className='mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400'
            aria-hidden
          />
          <div>
            <p className='text-sm font-medium'>
              {pending.length === 1
                ? '1 policy needs your acknowledgment.'
                : `${pending.length} policies need your acknowledgment.`}
            </p>
            <p className='text-xs text-muted-foreground'>
              Read the policies from your Policies page.
            </p>
          </div>
        </div>
        <Button asChild size='sm'>
          <Link href={paths.employee.policies}>View policies</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
