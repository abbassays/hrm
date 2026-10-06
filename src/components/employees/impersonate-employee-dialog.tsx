'use client';

import { useStartImpersonation } from '@/hooks/actions/use-impersonation';

import { ScrollableDialogContent } from '@/components/hrm/scrollable-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ImpersonateEmployeeDialogProps = {
  employeeId: string;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImpersonateEmployeeDialog({
  employeeId,
  employeeName,
  open,
  onOpenChange,
}: ImpersonateEmployeeDialogProps) {
  const start = useStartImpersonation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Impersonate {employeeName}?</DialogTitle>
          <DialogDescription>
            You will be signed in as {employeeName} and see exactly what they
            see. Anything you submit is recorded under their account, and this
            session is logged. Use the banner at the top or the sidebar to stop
            impersonating.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={start.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            isLoading={start.isPending}
            onClick={() => start.execute({ employeeId })}
          >
            Impersonate
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
