import { z } from 'zod';

import { PAYSLIP_LINE_ITEM_KINDS } from '@/constants/payroll-line-items';

/**
 * Payroll settings singleton. These map onto `payroll_settings` columns
 * (ot_multiplier_default / leave_pool_days / medical_accrual_monthly /
 * medical_cap). The admin Settings screen (BIT-15) splits them across three
 * cards, so the update action accepts a partial and writes only the keys a
 * given card submits — hence every field is optional here. Field names stay
 * camelCase to match the existing settings forms and the `HrmSettings` domain
 * type; the action translates them to the DB's snake_case columns.
 */
export const updatePayrollSettingsSchema = z
  .object({
    overtimeMultiplier: z.coerce.number().positive().max(9.99),
    taxRatePercent: z.coerce.number().min(0).max(100),
    leavePoolDays: z.coerce.number().int().nonnegative(),
    medicalMonthlyAccrual: z.coerce.number().int().nonnegative(),
    medicalBalanceCap: z.coerce.number().int().nonnegative(),
    // "defaults" preserves employee-specific allowance overrides; "all"
    // replaces them with the new company configuration.
    employeeScope: z.enum(['defaults', 'all']).default('defaults'),
  })
  .partial();

export type UpdatePayrollSettingsInput = z.infer<
  typeof updatePayrollSettingsSchema
>;

/** Create a run for a month. `period_month` is a first-of-month 'YYYY-MM-DD'
 *  date; `days_in_month` is derived server-side (never trusted from the client). */
export const createRunSchema = z.object({
  period_month: z.string().date(),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

/** Identifies a run for the calculate / lock RPCs. */
export const runIdSchema = z.object({
  run_id: z.string().uuid(),
});
export type RunIdInput = z.infer<typeof runIdSchema>;

/** Inline per-employee days-worked override. `null` clears the override and
 *  returns the row to its approved-unpaid-leave-derived value. */
export const overrideDaysWorkedSchema = z.object({
  payslip_id: z.string().uuid(),
  days_worked: z.coerce.number().nonnegative().max(31).nullable(),
});
export type OverrideDaysWorkedInput = z.infer<typeof overrideDaysWorkedSchema>;

/** Per-payslip overtime-multiplier override. `null` clears it so the current
 *  employee override (or company default) is used again. */
export const overrideOtMultiplierSchema = z.object({
  run_id: z.string().uuid(),
  payslip_ids: z.array(z.string().uuid()).min(1),
  overtime_multiplier: z.coerce.number().nonnegative().max(9.99).nullable(),
});
export type OverrideOtMultiplierInput = z.infer<
  typeof overrideOtMultiplierSchema
>;

/** Inline per-payslip overtime-hours override, written to the sidecar
 *  `overtime_hours_override` column. A `null` clears the override and hands the
 *  hours back to the employee's approved overtime logs — so the field is
 *  nullable *outside* the coercion (`z.coerce.number()` would turn a null into
 *  0, i.e. "override to zero hours", which is a different thing entirely).
 *  Bounded 0..744, the hours in a 31-day month. */
export const overrideOtHoursSchema = z.object({
  payslip_id: z.string().uuid(),
  overtime_hours: z.coerce.number().nonnegative().max(744).nullable(),
});
export type OverrideOtHoursInput = z.infer<typeof overrideOtHoursSchema>;

/** One stored payslip line item as it lives in the `custom_fields` jsonb array
 *  (positive `amount` = earning, negative = deduction). Deliberately permissive
 *  on `amount` — unlike `addCustomFieldSchema`, coercing an already-stored row
 *  must not reject a legacy 0. */
export const customFieldSchema = z.object({
  label: z.string(),
  amount: z.number(),
});
export type CustomField = z.infer<typeof customFieldSchema>;

/** Runtime guard for a single stored line item — lets `toCustomFields` keep the
 *  well-formed entries of a jsonb `custom_fields` array and drop any malformed one. */
export const isCustomField = (value: unknown): value is CustomField =>
  customFieldSchema.safeParse(value).success;

/** Append an ad-hoc line item to one or many payslips. A positive `amount` is an
 *  earning (Adjustment); a negative one is a deduction (Other). */
export const addCustomFieldSchema = z.object({
  run_id: z.string().uuid(),
  payslip_ids: z.array(z.string().uuid()).min(1),
  label: z.string().trim().min(1, 'Enter a label').max(60),
  amount: z.coerce.number().refine((n) => n !== 0, 'Amount cannot be 0'),
});
export type AddCustomFieldInput = z.infer<typeof addCustomFieldSchema>;

/** The add-a-line-item form behind each grid cell's panel. Only a magnitude is
 *  collected — the column the panel opened from decides the sign — so this
 *  rejects 0 and negatives up front instead of letting the server's
 *  `amount !== 0` refinement bounce them into an error toast. `label` mirrors
 *  `addCustomFieldSchema`'s bounds so anything valid here survives the action. */
export const payslipLineItemFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Enter a label')
    .max(60, 'Keep the label under 60 characters'),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Enter an amount above 0'),
});
export type PayslipLineItemFormInput = z.infer<
  typeof payslipLineItemFormSchema
>;

/** The bulk add dialog's form — the per-employee fields plus the column to file
 *  the item under. The grid cells infer that from the column they sit in; the
 *  bulk bar sits outside both, so it has to ask. */
export const bulkPayslipLineItemFormSchema = payslipLineItemFormSchema.extend({
  kind: z.enum(PAYSLIP_LINE_ITEM_KINDS),
});
export type BulkPayslipLineItemFormInput = z.infer<
  typeof bulkPayslipLineItemFormSchema
>;

/** Remove the custom field at `index` of a single payslip's `custom_fields`. */
export const removeCustomFieldSchema = z.object({
  payslip_id: z.string().uuid(),
  index: z.coerce.number().int().nonnegative(),
});
export type RemoveCustomFieldInput = z.infer<typeof removeCustomFieldSchema>;

/** Mail one payslip's invoice to its employee (the per-row Send button — a
 *  manual re-send of what locking the run already sent out). Only the id is
 *  accepted: the figures are read back server-side so a client can never mail
 *  a doctored payslip. */
export const sendInvoiceSchema = z.object({
  payslip_id: z.string().uuid(),
});
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;
