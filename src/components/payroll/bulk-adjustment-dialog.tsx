'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useAddPayslipCustomField } from '@/hooks/actions/use-add-payslip-custom-field';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import {
  payslipLineItemCopy,
  type PayslipLineItemKind,
} from '@/constants/payroll-line-items';
import {
  type PayslipLineItemFormInput,
  payslipLineItemFormSchema,
} from '@/schema/payroll';

type BulkAdjustmentDialogProps = {
  runId: string;
  /** The selected rows. One action call fans out across all of them. */
  payslipIds: string[];
  /** The toolbar button decides the sign, keeping adjustment and deduction
   *  actions explicit instead of making the admin choose it again in a modal. */
  kind: PayslipLineItemKind;
};

/** Adds the same adjustment or deduction to every selected employee at once. */
export function BulkAdjustmentDialog({
  runId,
  payslipIds,
  kind,
}: BulkAdjustmentDialogProps) {
  const [open, setOpen] = useState(false);
  const count = payslipIds.length;
  const copy = payslipLineItemCopy[kind];
  const actionLabel = `Add ${copy.noun.toLowerCase()}`;

  const form = useForm<PayslipLineItemFormInput>({
    resolver: zodResolver(payslipLineItemFormSchema),
    defaultValues: { label: '', amount: 0 },
  });

  // Owns its own action rather than taking the grid's: a rejected write has to
  // leave the dialog open with the input intact, and the shared hook upstairs
  // can only report the failure, not re-open what already closed.
  const addField = useAddPayslipCustomField(
    ({ label, amount, count: added }) => {
      const { noun } =
        payslipLineItemCopy[amount > 0 ? 'earning' : 'deduction'];
      toast.success(
        `${noun} "${label}" added to ${added} ${
          added === 1 ? 'employee' : 'employees'
        }`,
      );
      form.reset();
      setOpen(false);
    },
  );

  const onSubmit = ({ label, amount }: PayslipLineItemFormInput) => {
    addField.execute({
      run_id: runId,
      payslip_ids: payslipIds,
      label,
      amount: kind === 'deduction' ? -amount : amount,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type='button' variant='outline' size='sm' iconLeft={Plus}>
          {actionLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>
            Applies a {copy.noun.toLowerCase()} to the {count} selected{' '}
            {count === 1 ? 'employee' : 'employees'}. Each gets their own copy,
            so you can edit or remove it per employee afterward.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            <div className='grid grid-cols-3 gap-3'>
              <FormField
                control={form.control}
                name='label'
                render={({ field }) => (
                  <FormItem className='col-span-2'>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder={copy.labelPlaceholder} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit' isLoading={addField.isPending}>
                {actionLabel} for {count}{' '}
                {count === 1 ? 'employee' : 'employees'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
