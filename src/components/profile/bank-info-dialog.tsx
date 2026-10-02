'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useUpdateMyBank } from '@/hooks/actions/use-update-my-profile';

import { ControlledTextField } from '@/components/hrm/form-fields';
import { ScrollableDialogContent } from '@/components/hrm/scrollable-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';

import { bankInfoFields } from '@/constants/profile';
import { type BankInfoInput, bankInfoSchema } from '@/schema/onboarding';

type BankInfoDialogProps = {
  defaultValues: BankInfoInput;
};

export function BankInfoDialog({ defaultValues }: BankInfoDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<BankInfoInput>({
    resolver: zodResolver(bankInfoSchema),
    defaultValues,
  });

  const { execute, isPending } = useUpdateMyBank(() => {
    toast.success('Bank information updated');
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' iconLeft={Pencil}>
          Edit
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Edit bank information</DialogTitle>
          <DialogDescription>
            Payroll and payout exports use these details — double-check before
            saving.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => execute(values))}
            className='flex flex-col gap-4'
          >
            {bankInfoFields.map((config) => (
              <ControlledTextField
                key={config.name}
                control={form.control}
                config={config}
              />
            ))}
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit' isLoading={isPending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </ScrollableDialogContent>
    </Dialog>
  );
}
