'use client';

import { toast } from 'sonner';

import { useDeleteEmployee } from '@/hooks/actions/use-invite-employee';

import { ScrollableDialogContent } from '@/components/hrm/scrollable-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DeleteEmployeeDialogProps = {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A deliberate confirmation around a permanent account removal. The action
 * clears the auth account, employee record, all dependent HR data, and private
 * employee files; there is no restore path. */
export function DeleteEmployeeDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
}: DeleteEmployeeDialogProps) {
  const { execute, isPending } = useDeleteEmployee(() => {
    toast.success(`${employeeName} permanently deleted`);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Delete employee?</DialogTitle>
          <DialogDescription>
            This permanently deletes {employeeName}&apos;s account, profile,
            payroll records, requests, documents, notifications, and uploaded
            files. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Keep employee
          </Button>
          <Button
            variant='destructive'
            isLoading={isPending}
            onClick={() => execute({ employeeId })}
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
