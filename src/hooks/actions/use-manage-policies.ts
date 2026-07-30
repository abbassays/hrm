'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAction } from 'next-safe-action/hooks';

import { createPolicy, publishPolicyVersion } from '@/actions/policies';

import { onError } from '@/lib/show-error-toast';

import { QueryKeys } from '@/constants/query-keys';

/** Both writes change what employees see, so both invalidate the admin
 *  repository *and* the employee active-version list (which also feeds the
 *  sidebar's unacknowledged badge). */
const invalidatePolicies = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: [QueryKeys.POLICIES] });
  queryClient.invalidateQueries({ queryKey: [QueryKeys.ACTIVE_POLICIES] });
};

/** Create a policy and publish its version 1 (admin). The created row is handed
 *  to `onSuccess` so the caller can navigate straight to the new editor page.
 *
 *  A taken category comes back as a field error rather than a server error; pass
 *  `onCategoryError` to pin it under the input (the shared toast handler would
 *  otherwise announce it as a nameless "Validation Error"). */
export function useCreatePolicy(
  onSuccess?: (policyId: string) => void,
  onCategoryError?: (message: string) => void,
) {
  const queryClient = useQueryClient();
  return useAction(createPolicy, {
    onSuccess: ({ data }) => {
      invalidatePolicies(queryClient);
      if (data) onSuccess?.(data.id);
    },
    onError: (args) => {
      const categoryError =
        args.error.validationErrors?.fieldErrors?.category?.[0];
      if (categoryError && onCategoryError) {
        onCategoryError(categoryError);
        return;
      }
      onError(args);
    },
  });
}

/** Publish the next version of an existing policy (admin). The new version
 *  number comes back from the RPC — the client never computes it. */
export function usePublishPolicyVersion(
  onSuccess?: (version: {
    id: string;
    version: number;
    contentHtml: string;
    publishedAt: string;
  }) => void,
) {
  const queryClient = useQueryClient();
  return useAction(publishPolicyVersion, {
    onSuccess: ({ data }) => {
      invalidatePolicies(queryClient);
      if (data) {
        onSuccess?.({
          id: data.id,
          version: data.version,
          contentHtml: data.body_html,
          publishedAt: data.published_at,
        });
      }
    },
    onError,
  });
}
