import { format } from 'date-fns';

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

export const wiseFileName = (periodMonth: string, copyNumber = 0) =>
  exportFileName('wise-salaries', periodMonth, copyNumber);

export const defaultWiseReference = (periodMonth: string) =>
  `Salary ${format(periodMonth, 'MMM yyyy')}`;

// Wise's template leaves the header bare and quotes every data field.
export const toWiseCsv = (
  dataRows: readonly (readonly (string | number)[])[],
) => [WISE_HEADER.join(','), toCsv(dataRows, { quoteAll: true })].join('\r\n');
