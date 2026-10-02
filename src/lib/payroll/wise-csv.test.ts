import { describe, expect, it } from 'vitest';

import { defaultWiseReference, toWiseCsv, wiseFileName } from './wise-csv';

describe('toWiseCsv', () => {
  it('matches the Wise batch template: bare header, every data field quoted', () => {
    const csv = toWiseCsv([
      [
        'Aisha Rahman',
        'aisha@example.com',
        'Salary Oct 2026',
        '',
        'PERSON',
        'target',
        111111,
        'EUR',
        'PKR',
        'PK00XXXX0000000000000001',
      ],
      [
        'Bilal Anwar',
        '',
        'Salary Oct 2026',
        '',
        'PERSON',
        'target',
        222222,
        'USD',
        'PKR',
        'PK00YYYY0000000000000002',
      ],
    ]);

    expect(csv).toBe(
      [
        'name,recipientEmail,paymentReference,referenceNumber,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency,IBAN',
        '"Aisha Rahman","aisha@example.com","Salary Oct 2026","","PERSON","target","111111","EUR","PKR","PK00XXXX0000000000000001"',
        '"Bilal Anwar","","Salary Oct 2026","","PERSON","target","222222","USD","PKR","PK00YYYY0000000000000002"',
      ].join('\r\n'),
    );
  });
});

describe('wise file naming and reference', () => {
  it('names the file wise-salaries-<mon>-<yyyy>, with a copy suffix on re-export', () => {
    expect(wiseFileName('2026-10-01')).toBe('wise-salaries-oct-2026.csv');
    expect(wiseFileName('2026-10-01', 1)).toBe('wise-salaries-oct-2026(1).csv');
  });

  it('defaults the payment reference to Salary <Mon YYYY>', () => {
    expect(defaultWiseReference('2026-10-01')).toBe('Salary Oct 2026');
  });
});
