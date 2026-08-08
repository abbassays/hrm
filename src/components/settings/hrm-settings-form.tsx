'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { useUpdatePayrollSettings } from '@/hooks/actions/use-update-payroll-settings';
import { useHrmSettings } from '@/hooks/queries/settings';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';

import { type HrmSettingsInput, hrmSettingsSchema } from '@/schema/settings';

import { SettingRow, SettingsCard, SettingsGroup } from './settings-card';
import { UnitInput } from './unit-input';

import type { HrmSettings } from '@/types/hrm';

/** Every numeric HRM rule — leave, medical, payroll — edited in one card so
 *  the Configuration tab reads as a single console instead of scattered
 *  boxes. Saves all values in one pass to the settings cache. */
export function HrmSettingsForm() {
  const { data: settings, isLoading } = useHrmSettings();

  if (isLoading || !settings) {
    return <Skeleton className='h-96 rounded-xl' />;
  }

  // Mount the form only once settings exist and seed `useForm` from them, so
  // every input is controlled from its first render — otherwise the values
  // arrive a commit later and React warns about uncontrolled→controlled inputs.
  return <HrmSettingsFields settings={settings} />;
}

function HrmSettingsFields({ settings }: { settings: HrmSettings }) {
  const [pendingSave, setPendingSave] = useState<HrmSettingsInput | null>(null);
  const form = useForm<HrmSettingsInput>({
    resolver: zodResolver(hrmSettingsSchema),
    defaultValues: settings,
    values: settings,
  });

  // Persist to the real `payroll_settings` singleton (Module 2 backend). On
  // success the action invalidates the settings query, so `values: settings`
  // re-syncs the form and clears the dirty state.
  const { execute, isPending } = useUpdatePayrollSettings(() =>
    toast.success('Configuration saved'),
  );

  const onSubmit = (values: HrmSettingsInput) => setPendingSave(values);

  const applySettings = (employeeScope: 'defaults' | 'all') => {
    if (!pendingSave) return;
    execute({ ...pendingSave, employeeScope });
    setPendingSave(null);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='contents'>
        <SettingsCard
          icon={SlidersHorizontal}
          title='Rules & Limits'
          description='Values applied whenever leave, medical, or payroll is calculated.'
          footer={
            <Button
              type='submit'
              size='sm'
              disabled={!form.formState.isDirty}
              isLoading={isPending}
            >
              Save changes
            </Button>
          }
        >
          <SettingsGroup label='Leave'>
            <FormField
              control={form.control}
              name='leavePoolDays'
              render={({ field }) => (
                <FormItem className='py-0'>
                  <SettingRow
                    label='Annual leave pool'
                    description='Paid, Sick, and Half Day share it. Resets yearly.'
                  >
                    <FormControl>
                      <UnitInput
                        type='number'
                        step={1}
                        min={0}
                        unit='days'
                        {...field}
                      />
                    </FormControl>
                  </SettingRow>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroup>

          <SettingsGroup label='Medical Allowance'>
            <FormField
              control={form.control}
              name='medicalMonthlyAccrual'
              render={({ field }) => (
                <FormItem className='py-0'>
                  <SettingRow
                    label='Monthly accrual'
                    description="Added to each eligible employee's balance."
                  >
                    <FormControl>
                      <UnitInput
                        type='number'
                        step={500}
                        min={0}
                        unit='PKR'
                        {...field}
                      />
                    </FormControl>
                  </SettingRow>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='medicalBalanceCap'
              render={({ field }) => (
                <FormItem className='py-0'>
                  <SettingRow
                    label='Balance cap'
                    description='Accrual stops once a balance reaches this.'
                  >
                    <FormControl>
                      <UnitInput
                        type='number'
                        step={500}
                        min={0}
                        unit='PKR'
                        {...field}
                      />
                    </FormControl>
                  </SettingRow>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroup>

          <SettingsGroup label='Payroll'>
            <FormField
              control={form.control}
              name='overtimeMultiplier'
              render={({ field }) => (
                <FormItem className='py-0'>
                  <SettingRow
                    label='Overtime multiplier'
                    description='Applied to the hourly rate on every payroll run.'
                  >
                    <FormControl>
                      <UnitInput
                        type='number'
                        step={0.1}
                        min={0}
                        unit='×'
                        {...field}
                      />
                    </FormControl>
                  </SettingRow>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='taxRatePercent'
              render={({ field }) => (
                <FormItem className='py-0'>
                  <SettingRow
                    label='Tax deduction rate'
                    description='Withheld from gross each cycle. 0 disables it.'
                  >
                    <FormControl>
                      <UnitInput
                        type='number'
                        step={0.5}
                        min={0}
                        max={100}
                        unit='%'
                        {...field}
                      />
                    </FormControl>
                  </SettingRow>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsGroup>
        </SettingsCard>
      </form>
      <AlertDialog
        open={pendingSave !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSave(null);
        }}
      >
        <AlertDialogContent>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute right-3 top-3 size-8'
            onClick={() => setPendingSave(null)}
            disabled={isPending}
            aria-label='Close apply configuration dialog'
          >
            <X aria-hidden />
          </Button>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply configuration changes</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether these settings should preserve employee-specific
              allowance overrides or replace them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='space-y-3 text-sm'>
            <div>
              <p className='font-medium'>Only employees using defaults</p>
              <p className='text-muted-foreground'>
                Preserve manually configured leave, medical, and overtime
                values. Employees without overrides automatically receive the
                new company settings.
              </p>
            </div>
            <div>
              <p className='font-medium'>All employees</p>
              <p className='text-muted-foreground'>
                Replace every employee&apos;s leave, medical, and overtime
                configuration with the values above, including manual changes.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              className='bg-secondary text-secondary-foreground hover:bg-secondary/80'
              disabled={isPending}
              onClick={() => applySettings('defaults')}
            >
              Apply to defaults only
            </AlertDialogAction>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => applySettings('all')}
            >
              Apply to all employees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
