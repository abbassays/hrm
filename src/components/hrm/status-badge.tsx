import { Badge } from '@/components/ui/badge';

import {
  accountStatusLabels,
  payrollCycleStatusLabels,
  requestStatusLabels,
} from '@/constants/hrm-labels';

import { AccountStatus, PayrollCycleStatus, RequestStatus } from '@/types/hrm';

const presentations = {
  ...requestStatusLabels,
  ...accountStatusLabels,
  ...payrollCycleStatusLabels,
};

type StatusBadgeProps = {
  status: RequestStatus | AccountStatus | PayrollCycleStatus;
};

/** Single mapping from any HRM status to a badge, so colors and labels stay
 *  consistent across modules. */
export function StatusBadge({ status }: StatusBadgeProps) {
  // A status can briefly outlive a client deploy while a database migration is
  // rolling out. Render it safely instead of taking down the whole table.
  const { label, variant } = presentations[status] ?? {
    label: status.replace(/_/g, ' '),
    variant: 'secondary' as const,
  };
  return <Badge variant={variant}>{label}</Badge>;
}
