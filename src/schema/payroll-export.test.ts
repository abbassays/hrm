import { describe, expect, it } from 'vitest';

import { exportPayoneerSchema, exportWiseSchema } from './payroll-export';

const runId = '22222222-2222-4222-8222-222222222222';
const employeeId = '11111111-1111-4111-8111-111111111111';

const base = { run_id: runId, currencyByEmployee: { [employeeId]: 'eur' } };

describe('exportWiseSchema', () => {
  it('trims the reference, upper-cases currencies and defaults exclusions', () => {
    const parsed = exportWiseSchema.parse({
      ...base,
      paymentReference: '  Salary Oct 2026 ',
    });

    expect(parsed.paymentReference).toBe('Salary Oct 2026');
    expect(parsed.currencyByEmployee[employeeId]).toBe('EUR');
    expect(parsed.excludedEmployeeIds).toEqual([]);
  });

  it('rejects a blank reference and one over 35 characters', () => {
    const blank = exportWiseSchema.safeParse({
      ...base,
      paymentReference: ' ',
    });
    const long = exportWiseSchema.safeParse({
      ...base,
      paymentReference: 'x'.repeat(36),
    });
    const atLimit = exportWiseSchema.safeParse({
      ...base,
      paymentReference: 'x'.repeat(35),
    });

    expect(blank.success).toBe(false);
    expect(long.success).toBe(false);
    expect(atLimit.success).toBe(true);
  });

  it('requires at least one source currency, like the Payoneer schema', () => {
    const input = { run_id: runId, currencyByEmployee: {} };

    expect(exportPayoneerSchema.safeParse(input).success).toBe(false);
    expect(
      exportWiseSchema.safeParse({ ...input, paymentReference: 'Salary' })
        .success,
    ).toBe(false);
  });
});
