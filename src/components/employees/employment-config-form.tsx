'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  useResetEmployeeAllowanceOverrides,
  useUpdateEmploymentDetails,
} from '@/hooks/actions/use-update-employee';
import { useHrmSettings } from '@/hooks/queries/settings';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ControlledSelect } from '@/components/ui/form/controlled-select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

import { formatCurrency } from '@/utils/number-functions';

import {
  employmentStageLabels,
  employmentTypeLabels,
} from '@/constants/hrm-labels';
import {
  type EmploymentConfigInput,
  employmentConfigSchema,
  type EmploymentConfigValues,
} from '@/schema/employee';

import { Employee } from '@/types/hrm';

const employmentTypeOptions = Object.entries(employmentTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

const employmentStageOptions = Object.entries(employmentStageLabels).map(
  ([value, label]) => ({ value, label }),
);

type EmploymentConfigFormProps = {
  employee: Employee;
};

/** Admin-only payroll configuration (PRD 4.1) — not part of onboarding. */
export function EmploymentConfigForm({ employee }: EmploymentConfigFormProps) {
  const { data: settings } = useHrmSettings();

  const form = useForm<EmploymentConfigInput, unknown, EmploymentConfigValues>({
    resolver: zodResolver(employmentConfigSchema),
    defaultValues: {
      employmentType: employee.employmentType,
      employmentStage: employee.employmentStage,
      baseSalary: employee.baseSalary || 0,
      workingHours: employee.workingHours || 0,
      designation: employee.designation,
      department: employee.department,
      leavePoolDaysOverride: employee.leavePoolDaysOverride,
      medicalAccrualMonthlyOverride: employee.medicalAccrualMonthlyOverride,
      medicalCapOverride: employee.medicalCapOverride,
      otMultiplierOverride: employee.otMultiplierOverride,
    },
  });

  const { execute, isPending } = useUpdateEmploymentDetails(employee.id, () =>
    toast.success('Employment configuration saved'),
  );
  const { execute: resetOverrides, isPending: isResetting } =
    useResetEmployeeAllowanceOverrides(employee.id, () => {
      form.setValue('leavePoolDaysOverride', '', { shouldDirty: false });
      form.setValue('medicalAccrualMonthlyOverride', '', { shouldDirty: false });
      form.setValue('medicalCapOverride', '', { shouldDirty: false });
      form.setValue('otMultiplierOverride', '', { shouldDirty: false });
      toast.success('Allowance overrides reset to the global settings');
    });

  const onSubmit = (values: EmploymentConfigValues) =>
    execute({ ...values, employeeId: employee.id });

  return (
    <Card>
      <CardHeader className='pb-4'>
        <CardTitle className='text-lg font-medium'>
          Employment & Payroll Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='grid gap-4 sm:grid-cols-2'
          >
            <ControlledSelect<EmploymentConfigInput>
              name='employmentType'
              label='Employment type'
              options={employmentTypeOptions}
              placeholder='Select type'
            />
            <ControlledSelect<EmploymentConfigInput>
              name='employmentStage'
              label='Employment stage'
              options={employmentStageOptions}
              placeholder='Select stage'
            />
            <FormField
              control={form.control}
              name='designation'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <FormControl>
                    <Input placeholder='Frontend Engineer' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='department'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Engineering'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='baseSalary'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base salary (PKR)</FormLabel>
                  <FormControl>
                    <Input type='number' min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='workingHours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Working hours / month</FormLabel>
                  <FormControl>
                    <Input type='number' min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='sm:col-span-2'>
              <Separator className='mb-4' />
              <h3 className='text-sm font-medium'>Allowance overrides</h3>
              <p className='text-sm text-muted-foreground'>
                Set an allowance just for this employee. Leave a field blank to
                inherit the company-wide setting.
              </p>
            </div>

            <FormField
              control={form.control}
              name='leavePoolDaysOverride'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual leave pool (days)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      placeholder={
                        settings ? `${settings.leavePoolDays}` : 'Inherit'
                      }
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Blank inherits the global pool
                    {settings ? ` (${settings.leavePoolDays} days)` : ''}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Spacer so the two medical fields sit together on their own row. */}
            <div className='hidden sm:block' aria-hidden />
            <FormField
              control={form.control}
              name='medicalAccrualMonthlyOverride'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical accrual / month (PKR)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={500}
                      placeholder={
                        settings ? `${settings.medicalMonthlyAccrual}` : 'Inherit'
                      }
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Blank inherits the global accrual
                    {settings
                      ? ` (${formatCurrency(settings.medicalMonthlyAccrual)}/mo)`
                      : ''}
                    .
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='medicalCapOverride'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical balance cap (PKR)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step={500}
                      placeholder={
                        settings ? `${settings.medicalBalanceCap}` : 'Inherit'
                      }
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Blank inherits the global cap
                    {settings
                      ? ` (${formatCurrency(settings.medicalBalanceCap)})`
                      : ''}
                    .
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='otMultiplierOverride'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overtime multiplier</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0.01}
                      max={9.99}
                      step={0.01}
                      placeholder={
                        settings ? `${settings.overtimeMultiplier}x` : 'Inherit'
                      }
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Blank inherits the global overtime multiplier
                    {settings ? ` (${settings.overtimeMultiplier}x)` : ''}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='sm:col-span-2'>
              <div className='flex flex-wrap gap-3'>
                <Button type='submit' isLoading={isPending} disabled={isResetting}>
                  Save configuration
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  isLoading={isResetting}
                  disabled={isPending}
                  onClick={() => resetOverrides({ employeeId: employee.id })}
                >
                  Reset overrides to defaults
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
