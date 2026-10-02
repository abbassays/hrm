import { format } from 'date-fns';

import { WISE_ADDRESS_SOURCE_CURRENCIES } from '@/constants/payroll-export';

import { exportFileName, toCsv } from './csv';

export const WISE_HEADER = [
  'name',
  'recipientEmail',
  'paymentReference',
  'referenceNumber',
  'receiverType',
  'amountCurrency',
  'amount',
  'sourceCurrency',
  'targetCurrency',
  'IBAN',
] as const;

// Unverified against a downloaded USD → PKR template — rename here if it differs.
export const WISE_ADDRESS_HEADER = [
  'addressCountryCode',
  'addressCity',
  'addressFirstLine',
  'addressState',
  'addressPostCode',
] as const;

// Employees have no country column; PKR payees are paid into Pakistani accounts.
export const WISE_RECIPIENT_COUNTRY = 'PK';

export const needsWiseAddress = (sourceCurrency: string) =>
  (WISE_ADDRESS_SOURCE_CURRENCIES as readonly string[]).includes(
    sourceCurrency,
  );

export const wiseHeader = (sourceCurrency: string): readonly string[] =>
  needsWiseAddress(sourceCurrency)
    ? [...WISE_HEADER, ...WISE_ADDRESS_HEADER]
    : WISE_HEADER;

export const wiseFileName = (periodMonth: string, copyNumber = 0) =>
  exportFileName('wise-salaries', periodMonth, copyNumber);

export const defaultWiseReference = (periodMonth: string) =>
  `Salary ${format(periodMonth, 'MMM yyyy')}`;

// Wise's template leaves the header bare and quotes every data field.
export const toWiseCsv = (
  header: readonly string[],
  dataRows: readonly (readonly (string | number)[])[],
) => [header.join(','), toCsv(dataRows, { quoteAll: true })].join('\r\n');
