import { useQuery } from '@tanstack/react-query';

import { authQuery } from '@/lib/client/auth-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { QueryKeys } from '@/constants/query-keys';
import {
  type BankInfoInput,
  type DocType,
  docTypes,
  type PersonalInfoInput,
  type SocialAccountsInput,
} from '@/schema/onboarding';

import { type Tables } from '@/types/supabase';

/** The caller's saved onboarding values, mapped from the DB columns back onto
 *  the wizard's form shapes so each section can restore on refresh. Missing
 *  satellite rows (bank/socials not yet saved) collapse to empty strings. */
type OnboardingData = {
  email: string;
  personal: PersonalInfoInput;
  bank: BankInfoInput;
  social: SocialAccountsInput;
};

const fetchOnboarding = authQuery<undefined, OnboardingData>(
  async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, bank_details(*), socials(*)')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const bank = data?.bank_details ?? null;
    const social = data?.socials ?? null;

    return {
      email: data?.email ?? '',
      personal: {
        fullName: data?.full_name ?? '',
        dateOfBirth: data?.date_of_birth ?? '',
        phone: data?.phone ?? '',
        emergencyContact: data?.emergency_contact ?? '',
        address: data?.address ?? '',
        city: data?.city ?? '',
        postalCode: data?.postal_code ?? '',
        cnic: data?.cnic ?? '',
      },
      bank: {
        bankName: bank?.bank_name ?? '',
        accountHolderName: bank?.account_holder ?? '',
        accountNumber: bank?.account_number ?? '',
        iban: bank?.iban ?? '',
        branch: bank?.bank_branch ?? '',
      },
      social: {
        github: social?.github_url ?? '',
        linkedin: social?.linkedin_url ?? '',
        twitter: social?.twitter_url ?? '',
      },
    };
  },
);

/** Section 1–3 saved values for the onboarding wizard (self, via RLS). */
export const useOnboardingData = () =>
  useQuery({
    queryKey: [QueryKeys.ONBOARDING],
    queryFn: () => fetchOnboarding(),
  });

type UploadedDocument = Pick<
  Tables<'employee_documents'>,
  'doc_type' | 'storage_path' | 'uploaded_at' | 'file_name'
>;

const fetchEmployeeDocuments = authQuery<undefined, UploadedDocument[]>(
  async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('doc_type, storage_path, uploaded_at, file_name')
      .eq('employee_id', user.id);
    if (error) throw new Error(error.message);
    return data;
  },
);

/** The caller's uploaded identity documents (section 4). Keyed by userId so the
 *  upload mutation can invalidate exactly this cache entry. */
export const useEmployeeDocuments = (userId: string) =>
  useQuery({
    queryKey: [QueryKeys.EMPLOYEE_DOCUMENTS, userId],
    queryFn: () => fetchEmployeeDocuments(),
    enabled: !!userId,
  });

const IDENTITY_DOCS_BUCKET = 'identity-docs';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h — long enough to view a preview

/** A viewable identity document: a short-lived signed URL plus its stored MIME
 *  type (so the preview knows whether to render an image or a PDF). */
export type IdentityDocFile = { url: string; mimeType: string };

/**
 * Signed URLs + MIME types for an owner's uploaded identity documents, keyed by
 * doc_type. Reads directly from storage (the object metadata carries the MIME
 * type the DB row doesn't), so it powers previews for both the owner during
 * onboarding and an admin on the employee detail page — the `identity-docs`
 * RLS policies (`idocs_own` / `idocs_admin`) gate access to each.
 */
export const useIdentityDocFiles = (ownerId: string) =>
  useQuery({
    queryKey: [QueryKeys.IDENTITY_DOC_FILES, ownerId],
    enabled: !!ownerId,
    // Each fetch mints fresh signed URLs, so refetching swaps the <img>/<iframe>
    // src and reloads the preview. Keep the URLs stable for most of their TTL
    // (and don't refetch on focus) so previews don't flicker mid-session; the
    // upload mutation still invalidates this key to surface a replaced file.
    staleTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Partial<Record<DocType, IdentityDocFile>>> => {
      const supabase = createSupabaseBrowserClient();
      const { data: files, error } = await supabase.storage
        .from(IDENTITY_DOCS_BUCKET)
        .list(ownerId);
      if (error) throw new Error(error.message);

      const known = (files ?? []).filter((file) =>
        (docTypes as readonly string[]).includes(file.name),
      );
      if (!known.length) return {};

      const { data: signed, error: signError } = await supabase.storage
        .from(IDENTITY_DOCS_BUCKET)
        .createSignedUrls(
          known.map((file) => `${ownerId}/${file.name}`),
          SIGNED_URL_TTL_SECONDS,
        );
      if (signError) throw new Error(signError.message);

      const result: Partial<Record<DocType, IdentityDocFile>> = {};
      known.forEach((file, index) => {
        const signedUrl = signed?.[index]?.signedUrl;
        if (!signedUrl) return;
        const mimeType =
          (file.metadata as { mimetype?: string } | null)?.mimetype ?? '';
        result[file.name as DocType] = { url: signedUrl, mimeType };
      });
      return result;
    },
  });

/** A deliberately narrow variant for roster-style avatars. It reads the object
 * metadata to determine whether a photo exists, but signs only the image — not
 * the employee's CNIC documents that share the same private bucket. */
export const useProfilePhoto = (ownerId: string) =>
  useQuery({
    queryKey: [QueryKeys.IDENTITY_DOC_FILES, ownerId, 'profile-photo'],
    enabled: !!ownerId,
    staleTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<IdentityDocFile | null> => {
      const supabase = createSupabaseBrowserClient();
      const { data: files, error } = await supabase.storage
        .from(IDENTITY_DOCS_BUCKET)
        .list(ownerId);
      if (error) throw new Error(error.message);

      const photo = files?.find((file) => file.name === 'photo');
      const mimeType =
        (photo?.metadata as { mimetype?: string } | null)?.mimetype ?? '';
      if (!photo || !mimeType.startsWith('image/')) return null;

      const { data, error: signError } = await supabase.storage
        .from(IDENTITY_DOCS_BUCKET)
        .createSignedUrl(`${ownerId}/photo`, SIGNED_URL_TTL_SECONDS);
      if (signError) throw new Error(signError.message);
      if (!data?.signedUrl) return null;

      return { url: data.signedUrl, mimeType };
    },
  });
