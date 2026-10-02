import { exportFileName } from './csv';

export const PAYONEER_HEADER = [
  'Bank Account Holder Name',
  'Bank Account Number/IBAN',
  'Payoneer Balance to Pay From',
  'Amount to Pay',
  'Amount Recipient Gets',
  'Recipient Bank Account Currency',
  'Payment Reference (Optional)',
  'Transaction Description (Optional)',
] as const;

export const payoneerFileName = (periodMonth: string, copyNumber = 0) =>
  exportFileName('salaries', periodMonth, copyNumber);
