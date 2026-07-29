'use client';

import {
  ArrowRight,
  Check,
  MoreHorizontal,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useResendInvite } from '@/hooks/actions/use-invite-employee';
import { useApproveEmployee } from '@/hooks/actions/use-review-employee';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { paths } from '@/constants/paths';

import { CancelInviteDialog } from './cancel-invite-dialog';
import { DeleteEmployeeDialog } from './delete-employee-dialog';
import { ReturnOnboardingDialog } from './return-onboarding-dialog';

import { EmployeeListItem } from '@/types/hrm';

type EmployeesTableRowActionsProps = {
  employee: EmployeeListItem;
};

/** Per-row directory controls: a primary "View" button plus a trailing overflow
 *  menu whose contents depend on the row's lifecycle stage — approve / return
 *  for a `submitted` row, resend / cancel for an `invited` one. Rows with no
 *  extra actions render a same-size spacer so every "View" stays aligned. */
export function EmployeesTableRowActions({
  employee,
}: EmployeesTableRowActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const label = employee.fullName || employee.email;
  const isInvited = employee.status === 'invited';
  const isSubmitted = employee.status === 'submitted';

  const resend = useResendInvite(() =>
    toast.success(`Invitation resent to ${employee.email}`),
  );
  const approve = useApproveEmployee(() =>
    toast.success(`${employee.fullName || 'Employee'} approved and activated`),
  );

  return (
    <div className='flex items-center justify-end gap-1'>
      <Link href={paths.admin.employeeDetail(employee.id)}>
        <Button variant='ghost' size='sm' icon={ArrowRight}>
          View
        </Button>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label={`Actions for ${label}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48'>
          {isSubmitted && (
            <>
              <DropdownMenuItem
                disabled={approve.isPending}
                onSelect={() => approve.execute({ employeeId: employee.id })}
              >
                <Check />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setReturnOpen(true)}>
                <RotateCcw />
                Return for changes
              </DropdownMenuItem>
            </>
          )}
          {isInvited && (
            <>
              <DropdownMenuItem
                disabled={resend.isPending}
                onSelect={() => resend.execute({ employeeId: employee.id })}
              >
                <Send />
                Resend invite
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setCancelOpen(true)}
                className='text-destructive focus:text-destructive'
              >
                <X />
                Cancel invite
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className='text-destructive focus:text-destructive'
          >
            <Trash2 />
            Delete employee
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs live outside the menu so closing the menu doesn't unmount them. */}
      {isInvited && (
        <CancelInviteDialog
          employeeId={employee.id}
          employeeName={label}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
        />
      )}
      {isSubmitted && (
        <ReturnOnboardingDialog
          employeeId={employee.id}
          employeeName={label}
          open={returnOpen}
          onOpenChange={setReturnOpen}
        />
      )}
      <DeleteEmployeeDialog
        employeeId={employee.id}
        employeeName={label}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
