'use client';

import { format } from 'date-fns';
import { ArrowLeft, FileX2, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { useAcknowledgePolicy } from '@/hooks/actions/use-acknowledge-policy';
import {
  currentVersion,
  hasAcknowledged,
  latestAcknowledgment,
  useMyPolicyAcknowledgments,
  usePolicy,
} from '@/hooks/queries/policies';

import { EmptyState } from '@/components/hrm/empty-state';
import { PageHeader } from '@/components/hrm/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  getPolicyDiffSummary,
  highlightChangedBlocks,
} from '@/lib/policy-diff';

import { policyCategoryLabels } from '@/constants/hrm-labels';
import { paths } from '@/constants/paths';

import { DownloadPolicyButton } from './download-policy-button';
import { PolicyContent } from './policy-content';

type PolicyDetailPageContentProps = {
  policyId: string;
};

export function PolicyDetailPageContent({
  policyId,
}: PolicyDetailPageContentProps) {
  const { data: policy, isLoading: policyLoading } = usePolicy(policyId);
  const { data: acknowledgments, isLoading: acksLoading } =
    useMyPolicyAcknowledgments();
  const { executeAsync, isPending } = useAcknowledgePolicy();

  if (policyLoading || acksLoading)
    return <Skeleton className='h-96 rounded-xl' />;

  if (!policy) {
    return (
      <EmptyState
        icon={FileX2}
        title='Policy not found'
        description='This policy may have been removed.'
      />
    );
  }

  const latest = currentVersion(policy);
  const ack = latestAcknowledgment(acknowledgments ?? [], policy.id);
  // Compliance is per version id, not "at least version N" — only an
  // acknowledgment of the version on screen counts.
  const upToDate = hasAcknowledged(acknowledgments ?? [], latest.id);

  // Diffed against whatever version the employee last acknowledged (not
  // necessarily the immediately-previous one, if they skipped an update),
  // so the highlighting always reflects everything new to them.
  const previousVersion = policy.versions.at(-2);
  const displayHtml =
    previousVersion
      ? highlightChangedBlocks(previousVersion.contentHtml, latest.contentHtml)
      : latest.contentHtml;
  const diffSummary = previousVersion
    ? getPolicyDiffSummary(previousVersion.contentHtml, latest.contentHtml)
    : 0;

  const handleAcknowledge = async () => {
    const result = await executeAsync({ policyVersionId: latest.id });
    if (result?.data) toast.success(`${policy.title} acknowledged`);
  };

  return (
    <>
      <div>
        <Link href={paths.employee.policies}>
          <Button variant='ghost' size='sm' iconLeft={ArrowLeft}>
            Back to Policies
          </Button>
        </Link>
      </div>

      <PageHeader
        title={policy.title}
        description={`${policyCategoryLabels[policy.category]} · Version ${latest.version}`}
      >
        <DownloadPolicyButton policy={policy} version={latest} />
      </PageHeader>

      {!upToDate && (
        <Card className='border-amber-500/40 bg-amber-500/5'>
          <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-start gap-3'>
              <Megaphone
                className='mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400'
                aria-hidden
              />
              <div className='flex flex-col gap-0.5'>
                <p className='text-sm font-medium'>
                  {ack
                    ? `This policy was updated on ${format(latest.publishedAt, 'MMM d, yyyy')}. Changes are highlighted below — read and acknowledge.`
                    : 'Please review and acknowledge this policy'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleAcknowledge}
              isLoading={isPending}
              className='shrink-0'
            >
              I've read and acknowledge this
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className='p-6'>
          {diffSummary > 0 && (
            <div className='mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300'>
              <Megaphone className='size-4 shrink-0' aria-hidden />
              <span>
                {diffSummary} change{diffSummary === 1 ? '' : 's'} since the
                previous version 
                .
              </span>
            </div>
          )}
          <PolicyContent html={displayHtml} />
        </CardContent>
      </Card>

      {!!ack && (
        <p className='text-xs text-muted-foreground'>
          {upToDate
            ? `Acknowledged on ${format(ack.acknowledgedAt, 'MMM d, yyyy')}`
            : `Last acknowledged version ${ack.acknowledgedVersion} on ${format(
                ack.acknowledgedAt,
                'MMM d, yyyy',
              )}`}
        </p>
      )}
    </>
  );
}
