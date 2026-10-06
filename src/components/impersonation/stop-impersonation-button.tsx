'use client';

import { UserX } from 'lucide-react';

import { useStopImpersonation } from '@/hooks/actions/use-impersonation';

import { Button } from '@/components/ui/button';

export function StopImpersonationButton() {
  const { execute, isPending } = useStopImpersonation();

  return (
    <Button
      size='sm'
      variant='secondary'
      iconLeft={UserX}
      isLoading={isPending}
      onClick={() => execute({})}
    >
      Stop impersonating
    </Button>
  );
}
