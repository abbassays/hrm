import { z } from 'zod';

import {
  BALANCE_CURRENCIES,
  WISE_REFERENCE_MAX_LENGTH,
} from '@/constants/payroll-export';

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO currency code');

export const exportPayoneerSchema = z.object({
  run_id: z.string().uuid(),
  currencyByEmployee: z
    .record(z.string().uuid(), currencyCode)
    .refine(
      (map) => Object.keys(map).length > 0,
      'Choose a source currency for at least one employee',
    ),
  excludedEmployeeIds: z.array(z.string().uuid()).default([]),
});

export type ExportPayoneerInput = z.infer<typeof exportPayoneerSchema>;

export const wiseFileSchema = z.object({
  sourceCurrency: z.enum(BALANCE_CURRENCIES),
  paymentReference: z
    .string()
    .trim()
    .min(1, 'Enter a payment reference')
    .max(
      WISE_REFERENCE_MAX_LENGTH,
      `Keep it to ${WISE_REFERENCE_MAX_LENGTH} characters or fewer`,
    ),
});

export type WiseFileInput = z.infer<typeof wiseFileSchema>;

export const exportWiseSchema = exportPayoneerSchema
  .omit({ currencyByEmployee: true })
  .merge(wiseFileSchema);

export type ExportWiseInput = z.infer<typeof exportWiseSchema>;
