'use client';

import { UserCog } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { ImpersonateEmployeeDialog } from './impersonate-employee-dialog';

type ImpersonateEmployeeButtonProps = {
  employeeId: string;
  employeeName: string;
};

export function ImpersonateEmployeeButton({
  employeeId,
  employeeName,
}: ImpersonateEmployeeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        iconLeft={UserCog}
        onClick={() => setOpen(true)}
      >
        Impersonate
      </Button>
      <ImpersonateEmployeeDialog
        employeeId={employeeId}
        employeeName={employeeName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
