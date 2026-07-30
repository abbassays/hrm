'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';

import {
  saveBank,
  savePersonal,
  saveSocials,
  submitOnboarding,
} from '@/actions/onboarding';

import { onError } from '@/lib/show-error-toast';

import { QueryKeys } from '@/constants/query-keys';

/** Shared: after a section autosaves, refresh the wizard's restored values so
 *  navigating back shows what was just persisted. */
function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: [QueryKeys.ONBOARDING] });
}

/** Section 1 · Personal autosave. */
export function useSavePersonal() {
  const invalidateProfile = useInvalidateProfile();
  return useAction(savePersonal, { onSuccess: invalidateProfile, onError });
}

/** Section 2 · Bank autosave. */
export function useSaveBank() {
  const invalidateProfile = useInvalidateProfile();
  return useAction(saveBank, { onSuccess: invalidateProfile, onError });
}

/** Section 3 · Socials autosave. */
export function useSaveSocials() {
  const invalidateProfile = useInvalidateProfile();
  return useAction(saveSocials, { onSuccess: invalidateProfile, onError });
}

/** Section 5 · Complete — activates the employee (onboarding → active). */
export function useSubmitOnboarding() {
  const invalidateProfile = useInvalidateProfile();
  return useAction(submitOnboarding, { onSuccess: invalidateProfile, onError });
}
