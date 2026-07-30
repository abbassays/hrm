'use client';

import { ArrowLeft, FileX2, Send, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { usePublishPolicyVersion } from '@/hooks/actions/use-manage-policies';
import {
  currentVersion,
  useActiveEmployees,
  useAllPolicyAcknowledgments,
  usePolicy,
} from '@/hooks/queries/policies';

import { ConfirmDialog } from '@/components/hrm/confirm-dialog';
import { EmptyState } from '@/components/hrm/empty-state';
import { PageHeader } from '@/components/hrm/page-header';
import { RichTextEditor } from '@/components/hrm/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { policyCategoryLabels } from '@/constants/hrm-labels';
import { paths } from '@/constants/paths';

import { DownloadPolicyButton } from './download-policy-button';
import { ImportPdfButton } from './import-pdf-button';
import { PolicyVersionHistory } from './policy-version-history';

import { PolicyVersion } from '@/types/hrm';

type PolicyEditorPageContentProps = {
  policyId: string;
};

/** Four actions share the header, so they run one size down from the usual
 *  `sm` to avoid crowding it. */
const compactButton = 'h-8 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5';

export function PolicyEditorPageContent({
  policyId,
}: PolicyEditorPageContentProps) {
  const { data: policy, isLoading } = usePolicy(policyId);
  const { data: employees } = useActiveEmployees();
  const { data: acknowledgments } = useAllPolicyAcknowledgments();

  const [draftHtml, setDraftHtml] = useState<string | null>(null);
  // The publish RPC returns the complete new version. Retain it until the
  // invalidated policy query contains that row, so the editor never falls back
  // to stale content while the refetch is in flight.
  const [justPublished, setJustPublished] = useState<PolicyVersion | null>(
    null,
  );
  // CKEditor's `data` prop only seeds the *initial* content — it never
  // re-syncs when the prop changes. Anything that swaps the body out from
  // under the editor therefore has to force a fresh mount, or the editor
  // silently keeps showing stale content while the header claims otherwise.
  // This counter covers revert / discard / PDF import; publishing is handled
  // by folding the active version number into the key below.
  const [editorNonce, setEditorNonce] = useState(0);

  // The version number comes back from `publish_policy_version` rather than
  // being guessed here — the RPC owns the numbering and the active-version flip.
  const { execute: publish, isPending: isPublishing } = usePublishPolicyVersion(
    (version) => {
      setDraftHtml(null);
      setJustPublished(version);
      toast.success(
        `${policy?.title ?? 'Policy'} updated to version ${version.version}`,
      );
    },
  );

  useEffect(() => {
    if (
      justPublished &&
      policy?.versions.some((version) => version.id === justPublished.id)
    ) {
      setJustPublished(null);
    }
  }, [justPublished, policy?.versions]);

  if (isLoading) return <Skeleton className='h-96 rounded-xl' />;

  if (!policy) {
    return (
      <EmptyState
        icon={FileX2}
        title='Policy not found'
        description='This policy may have been removed.'
      />
    );
  }

  const displayedVersions =
    justPublished &&
    !policy.versions.some((version) => version.id === justPublished.id)
      ? [...policy.versions, justPublished]
      : policy.versions;
  const latest = currentVersion({ ...policy, versions: displayedVersions });
  const content = draftHtml ?? latest.contentHtml;
  const isDirty = draftHtml !== null && draftHtml !== latest.contentHtml;

  const handleRevert = (version: PolicyVersion) => {
    setDraftHtml(version.contentHtml);
    setEditorNonce((nonce) => nonce + 1);
    toast.info(
      `Version ${version.version} loaded into the editor — publish to make it current, or discard changes to go back.`,
    );
  };

  const handleDiscard = () => {
    setDraftHtml(null);
    setEditorNonce((nonce) => nonce + 1);
    toast.info(`Draft discarded — back to version ${latest.version}.`);
  };

  const handlePdfImported = (html: string) => {
    setDraftHtml(html);
    setEditorNonce((nonce) => nonce + 1);
  };

  const handlePublish = () =>
    publish({ policyId: policy.id, bodyHtml: content });

  return (
    <>
      <div>
        <Link href={paths.admin.policies}>
          <Button variant='ghost' size='sm' iconLeft={ArrowLeft}>
            Back to Policies
          </Button>
        </Link>
      </div>

      <PageHeader
        title={policy.title}
        description={`${policyCategoryLabels[policy.category]} · Version ${latest.version}`}
      >
        <ImportPdfButton
          size='sm'
          className={compactButton}
          onImported={handlePdfImported}
        />
        <DownloadPolicyButton
          size='sm'
          className={compactButton}
          policy={policy}
          version={latest}
        />
        <Button
          variant='outline'
          size='sm'
          className={compactButton}
          iconLeft={Undo2}
          disabled={!isDirty}
          onClick={handleDiscard}
        >
          Discard changes
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              size='sm'
              className={compactButton}
              iconLeft={Send}
              disabled={!isDirty}
              isLoading={isPublishing}
            >
              Publish update
            </Button>
          }
          title='Publish this update?'
          description='Employees who already acknowledged an earlier version will see the changed lines highlighted and be prompted to re-acknowledge.'
          confirmLabel='Publish new version'
          onConfirm={handlePublish}
        />
      </PageHeader>

      {/* Keyed on the version being edited: when a publish lands and the query
          refetches, `latest` becomes the new version and the editor remounts
          carrying its body — so what's on screen always matches the active
          version in the header. */}
      <RichTextEditor
        key={`v${latest.version}-${editorNonce}`}
        value={content}
        onChange={setDraftHtml}
      />

      <div className='flex flex-col gap-3'>
        <h2 className='text-lg font-semibold'>Version history</h2>
        <PolicyVersionHistory
          policy={policy}
          versions={displayedVersions}
          currentVersionNumber={latest.version}
          employees={employees ?? []}
          acknowledgments={(acknowledgments ?? []).filter(
            (ack) => ack.policyId === policy.id,
          )}
          onRevert={handleRevert}
        />
      </div>
    </>
  );
}
