import { describe, expect, it } from 'vitest';

import {
  overrideDaysWorkedSchema,
  overrideOtMultiplierSchema,
} from './payroll';

const payslipId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';

describe('payroll override schemas', () => {
  it('distinguishes clearing a days-worked override from overriding to zero', () => {
    expect(
      overrideDaysWorkedSchema.parse({
        payslip_id: payslipId,
        days_worked: null,
      }).days_worked,
    ).toBeNull();

    expect(
      overrideDaysWorkedSchema.parse({
        payslip_id: payslipId,
        days_worked: 0,
      }).days_worked,
    ).toBe(0);
  });

  it('distinguishes clearing an OT multiplier override from overriding to zero', () => {
    const base = { run_id: runId, payslip_ids: [payslipId] };

    expect(
      overrideOtMultiplierSchema.parse({
        ...base,
        overtime_multiplier: null,
      }).overtime_multiplier,
    ).toBeNull();

    expect(
      overrideOtMultiplierSchema.parse({
        ...base,
        overtime_multiplier: 0,
      }).overtime_multiplier,
    ).toBe(0);
  });

  it('rejects override values outside database bounds', () => {
    expect(
      overrideDaysWorkedSchema.safeParse({
        payslip_id: payslipId,
        days_worked: 31.5,
      }).success,
    ).toBe(false);

    expect(
      overrideOtMultiplierSchema.safeParse({
        run_id: runId,
        payslip_ids: [payslipId],
        overtime_multiplier: 10,
      }).success,
    ).toBe(false);
  });
});
