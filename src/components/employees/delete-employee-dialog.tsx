'use client';

import { toast } from 'sonner';

import {
  useDisableEmployee,
  useEnableEmployee,
} from '@/hooks/actions/use-invite-employee';

import { ScrollableDialogContent } from '@/components/hrm/scrollable-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type EmployeeAccessDialogProps = {
  employeeId: string;
  employeeName: string;
  isDisabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A deliberate confirmation around a reversible employee access change. */
export function EmployeeAccessDialog({
  employeeId,
  employeeName,
  isDisabled,
  open,
  onOpenChange,
}: EmployeeAccessDialogProps) {
  const disable = useDisableEmployee(() => {
    toast.success(`${employeeName} disabled`);
    onOpenChange(false);
  });
  const enable = useEnableEmployee(() => {
    toast.success(`${employeeName} re-enabled`);
    onOpenChange(false);
  });
  const action = isDisabled ? enable : disable;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {isDisabled ? 'Re-enable employee?' : 'Disable employee?'}
          </DialogTitle>
          <DialogDescription>
            {isDisabled
              ? `Restore ${employeeName}'s login access and previous account status.`
              : `Block ${employeeName}'s login while keeping their profile, payroll records, requests, documents, notifications, and uploaded files intact.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={action.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={isDisabled ? 'default' : 'destructive'}
            isLoading={action.isPending}
            onClick={() => action.execute({ employeeId })}
          >
            {isDisabled ? 'Re-enable employee' : 'Disable employee'}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
