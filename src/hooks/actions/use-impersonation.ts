'use client';

import { useAction } from 'next-safe-action/hooks';

import { startImpersonation, stopImpersonation } from '@/actions/impersonation';

import { onError } from '@/lib/show-error-toast';

import { paths } from '@/constants/paths';

// Full page loads on purpose: the auth cookies just changed identity, so the
// React Query cache, the browser Supabase client and PostHog must start over.
export function useStartImpersonation() {
  return useAction(startImpersonation, {
    onSuccess: () => window.location.assign(paths.home),
    onError,
  });
}

export function useStopImpersonation() {
  return useAction(stopImpersonation, {
    onSuccess: ({ data }) =>
      window.location.assign(data?.returnTo ?? paths.admin.dashboard),
    onError,
  });
}
