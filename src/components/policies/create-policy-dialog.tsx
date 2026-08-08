'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useCreatePolicy } from '@/hooks/actions/use-manage-policies';

import { ImportPdfButton } from '@/components/policies/import-pdf-button';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ControlledRichText } from '@/components/ui/form/controlled-rich-text';
import { ControlledSelect } from '@/components/ui/form/controlled-select';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { policyCategoryLabels } from '@/constants/hrm-labels';
import { paths } from '@/constants/paths';
import {
  type CreatePolicyInput,
  createPolicySchema,
  type PolicyCategoryInput,
} from '@/schema/policy';

const categoryOptions = Object.entries(policyCategoryLabels).map(
  ([value, label]) => ({ value: value as PolicyCategoryInput, label }),
);

type CreatePolicyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePolicyDialog({
  open,
  onOpenChange,
}: CreatePolicyDialogProps) {
  const router = useRouter();
  // CKEditor only reads its `data` prop on mount, so a PDF import has to
  // force a fresh mount for the imported content to appear.
  const [editorKey, setEditorKey] = useState(0);

  const form = useForm<CreatePolicyInput>({
    resolver: zodResolver(createPolicySchema),
    defaultValues: {
      title: '',
      category: 'general',
      contentHtml: '',
    },
  });

  const resetForm = () => {
    form.reset({ title: '', category: 'general', contentHtml: '' });
    setEditorKey((key) => key + 1);
  };

  const { execute, isPending } = useCreatePolicy(
    (policyId) => {
      toast.success(`${form.getValues('title')} published`);
      onOpenChange(false);
      resetForm();
      router.push(paths.admin.policyDetail(policyId));
    },
    (message) => form.setError('title', { message }),
  );

  const handlePdfImported = (html: string, fileName: string) => {
    form.setValue('contentHtml', html, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (!form.getValues('title')) {
      form.setValue('title', fileName.replace(/[-_]+/g, ' ').trim(), {
        shouldDirty: true,
      });
    }
    setEditorKey((key) => key + 1);
  };

  const onSubmit = (values: CreatePolicyInput) => execute(values);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <SheetContent className='flex w-full min-w-0 flex-col gap-6 overflow-hidden sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>New policy</SheetTitle>
          <SheetDescription>
            Employees will be able to view this as soon as it&apos;s published.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex min-h-0 min-w-0 flex-1 flex-col gap-4'
          >
            <div className='-mx-1 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-1'>
              <div className='grid min-w-0 grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='title'
                  render={({ field }) => (
                    <FormItem className='min-w-0'>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='e.g. Remote Work Policy'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className='min-w-0 space-y-1'>
                  <ControlledSelect<CreatePolicyInput>
                    name='category'
                    label='Category'
                    options={categoryOptions}
                    placeholder='Select category'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Used to group policies. Several may share a category.
                  </p>
                </div>
              </div>
              <div className='flex justify-end'>
                <ImportPdfButton onImported={handlePdfImported} />
              </div>
              <ControlledRichText<CreatePolicyInput>
                key={editorKey}
                name='contentHtml'
                label='Content'
                containerClassName='flex min-h-0 min-w-0 flex-1 flex-col'
                editorClassName='rich-text-editor--fill flex min-h-0 min-w-0 flex-1 flex-col'
              />
            </div>
            <SheetFooter className='shrink-0 gap-2 border-t border-border pt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type='submit' isLoading={isPending}>
                Publish
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
