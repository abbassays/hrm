'use client';

import {
  ArrowRight,
  Ban,
  MoreHorizontal,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { useResendInvite } from '@/hooks/actions/use-invite-employee';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { paths } from '@/constants/paths';

import { CancelInviteDialog } from './cancel-invite-dialog';
import { EmployeeAccessDialog } from './delete-employee-dialog';

import { EmployeeListItem } from '@/types/hrm';

type EmployeesTableRowActionsProps = {
  employee: EmployeeListItem;
};

/** Per-row directory controls: view, invite management while still invited,
 * and reversible access control. Completed onboarding activates automatically. */
export function EmployeesTableRowActions({
  employee,
}: EmployeesTableRowActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const label = employee.fullName || employee.email;
  const isInvited = employee.status === 'invited';
  const isDisabled = employee.status === 'disabled';

  const resend = useResendInvite(() =>
    toast.success(`Invitation resent to ${employee.email}`),
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
            onSelect={() => setAccessOpen(true)}
            className={
              isDisabled ? undefined : 'text-destructive focus:text-destructive'
            }
          >
            {isDisabled ? <RotateCcw /> : <Ban />}
            {isDisabled ? 'Re-enable employee' : 'Disable employee'}
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
      <EmployeeAccessDialog
        employeeId={employee.id}
        employeeName={label}
        isDisabled={isDisabled}
        open={accessOpen}
        onOpenChange={setAccessOpen}
      />
    </div>
  );
}
