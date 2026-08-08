'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';

import { summonNotetaker } from '@/actions/fireflies';

import { onError } from '@/lib/show-error-toast';

import { QueryKeys } from '@/constants/query-keys';

/** Send the Fireflies bot into a live call. On success the history list is
 *  invalidated so the new meeting appears immediately, already polling for the
 *  bot to confirm it joined. */
export function useSummonNotetaker(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useAction(summonNotetaker, {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.NOTETAKER_MEETINGS],
      });
      onSuccess?.();
    },
    onError,
  });
}
