import { Metadata } from 'next';

import { ApprovalsQueue } from '@/components/approvals/approvals-queue';
import { PageHeader } from '@/components/hrm/page-header';

export const metadata: Metadata = { title: 'Approvals' };

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader
        title='Approvals'
        description='Review pending leave, medical, and overtime submissions one at a time.'
      />
      <ApprovalsQueue />
    </>
  );
}
