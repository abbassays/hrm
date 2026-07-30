'use client';

import { format } from 'date-fns';
import { FileText, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useDeletePolicy } from '@/hooks/actions/use-manage-policies';
import { currentVersion, usePolicies } from '@/hooks/queries/policies';

import { ConfirmDialog } from '@/components/hrm/confirm-dialog';
import { EmptyState } from '@/components/hrm/empty-state';
import { PageHeader } from '@/components/hrm/page-header';
import { HrmSettingsForm } from '@/components/settings/hrm-settings-form';
import { OnboardingTemplateForm } from '@/components/settings/onboarding-template-form';
import { ProjectsSettingsCard } from '@/components/settings/projects-settings-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { policyCategoryLabels } from '@/constants/hrm-labels';
import { paths } from '@/constants/paths';

import { CreatePolicyDialog } from './create-policy-dialog';
// Linkage panel removed — configuration lives under the Configuration tab.

const TAB_VALUES = ['documents', 'configuration', 'onboarding-email'] as const;

export function AdminPoliciesPageContent() {
  const { data: policies, isLoading } = usePolicies();
  const { executeAsync: deletePolicy, isPending: isDeleting } =
    useDeletePolicy();
  const [createOpen, setCreateOpen] = useState(false);

  // Deep-linkable tabs — e.g. the invite dialog links here with
  // ?tab=onboarding-email to open the email template directly.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = TAB_VALUES.includes(
    requestedTab as (typeof TAB_VALUES)[number],
  )
    ? requestedTab!
    : 'documents';

  return (
    <>
      <PageHeader
        title='Policies'
        description='Company policy documents and the numeric rules that govern leave, medical allowance, and payroll.'
      />

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value='documents'>Documents</TabsTrigger>
          <TabsTrigger value='configuration'>Configuration</TabsTrigger>
          <TabsTrigger value='onboarding-email'>Onboarding Email</TabsTrigger>
        </TabsList>

        <TabsContent value='documents' className='flex flex-col gap-4'>
          <div className='flex justify-end gap-2'>
            <Button iconLeft={Plus} onClick={() => setCreateOpen(true)}>
              New Policy
            </Button>
          </div>
          {isLoading ? (
            <Skeleton className='h-64 rounded-xl' />
          ) : !policies?.length ? (
            <EmptyState
              icon={FileText}
              title='No policies yet'
              description='Create the first policy document for employees to view and acknowledge.'
            />
          ) : (
            <ul className='flex flex-col divide-y divide-border rounded-lg border border-border'>
              {policies.map((policy) => {
                const latest = currentVersion(policy);
                return (
                  <li key={policy.id}>
                    <div className='flex items-center gap-2 px-2 py-1.5'>
                      <Link
                        href={paths.admin.policyDetail(policy.id)}
                        className='flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground'
                      >
                        <div className='flex min-w-0 flex-col gap-0.5'>
                          <p className='truncate text-sm font-medium'>
                            {policy.title}
                          </p>
                          <p className='truncate text-xs text-muted-foreground'>
                            Version {latest.version} · Updated{' '}
                            {format(latest.publishedAt, 'MMM d, yyyy')}
                          </p>
                        </div>
                        <Badge variant='outline'>
                          {policyCategoryLabels[policy.category]}
                        </Badge>
                      </Link>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-8 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            aria-label={`Delete ${policy.title}`}
                            disabled={isDeleting}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        }
                        title={`Delete ${policy.title}?`}
                        description='This permanently removes the policy document, every published version, and employee acknowledgment history for it.'
                        confirmLabel='Delete policy'
                        destructive
                        isLoading={isDeleting}
                        onConfirm={() => deletePolicy({ policyId: policy.id })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* Linkage tab removed; configuration is on the 'Configuration' tab. */}

        <TabsContent value='configuration'>
          <p className='mb-4 text-sm text-muted-foreground'>
            Module-wide values applied whenever leave, medical allowance, or
            payroll is calculated. Changes take effect on the next run.
          </p>
          <div className='grid items-start gap-4 lg:grid-cols-2'>
            <HrmSettingsForm />
            <ProjectsSettingsCard />
          </div>
        </TabsContent>

        <TabsContent value='onboarding-email'>
          <p className='mb-4 text-sm text-muted-foreground'>
            The invitation email sent to every new employee. Edit it once — the
            same template is reused for all invitations.
          </p>
          <OnboardingTemplateForm />
        </TabsContent>
      </Tabs>

      <CreatePolicyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingCategories={(policies ?? []).map((policy) => policy.category)}
      />
    </>
  );
}
