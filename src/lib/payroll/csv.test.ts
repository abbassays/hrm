import { describe, expect, it } from 'vitest';

import { exportFileName, toCsv } from './csv';
import { PAYONEER_HEADER, payoneerFileName } from './payoneer-csv';

describe('toCsv', () => {
  it('quotes only fields that need it by default', () => {
    const csv = toCsv([
      [...PAYONEER_HEADER],
      ['Aisha Rahman', 'PK00XXXX0000000000000001', 'EUR', '', 111111, 'PKR'],
      ['Anwar, Bilal', 'PK00YYYY0000000000000002', 'USD', '', 222222, 'PKR'],
      ['Sara "Sam" Ali', 'PK00ZZZZ0000000000000003', 'GBP', '', 3, 'PKR'],
    ]);

    expect(csv).toBe(
      [
        'Bank Account Holder Name,Bank Account Number/IBAN,Payoneer Balance to Pay From,Amount to Pay,Amount Recipient Gets,Recipient Bank Account Currency,Payment Reference (Optional),Transaction Description (Optional)',
        'Aisha Rahman,PK00XXXX0000000000000001,EUR,,111111,PKR',
        '"Anwar, Bilal",PK00YYYY0000000000000002,USD,,222222,PKR',
        '"Sara ""Sam"" Ali",PK00ZZZZ0000000000000003,GBP,,3,PKR',
      ].join('\r\n'),
    );
  });

  it('quotes every field, including blanks and numbers, with quoteAll', () => {
    expect(toCsv([['Sara "Sam" Ali', '', 111111]], { quoteAll: true })).toBe(
      '"Sara ""Sam"" Ali","","111111"',
    );
  });
});

describe('exportFileName', () => {
  it('names the file after the month it pays', () => {
    expect(exportFileName('wise-salaries', '2026-10-01')).toBe(
      'wise-salaries-oct-2026.csv',
    );
  });

  it('adds a copy suffix to re-exports', () => {
    expect(exportFileName('wise-salaries', '2026-10-01', 2)).toBe(
      'wise-salaries-oct-2026(2).csv',
    );
  });

  it('keeps the Payoneer file names it had before the extraction', () => {
    expect(payoneerFileName('2026-10-01')).toBe('salaries-oct-2026.csv');
    expect(payoneerFileName('2026-10-01', 1)).toBe('salaries-oct-2026(1).csv');
  });
});
