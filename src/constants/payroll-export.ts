export const BALANCE_CURRENCIES = ['USD', 'GBP', 'EUR'] as const;

export type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number];

export const DEFAULT_BALANCE_CURRENCY: BalanceCurrency = 'USD';

export const isBalanceCurrency = (value: string): value is BalanceCurrency =>
  (BALANCE_CURRENCIES as readonly string[]).includes(value);

export const EXPORT_PROVIDERS = ['wise', 'payoneer'] as const;

export type ExportProvider = (typeof EXPORT_PROVIDERS)[number];

export const EXPORT_PROVIDER_LABELS: Record<ExportProvider, string> = {
  wise: 'Wise',
  payoneer: 'Payoneer',
};

export const EXPORT_PROVIDER_HINTS: Record<ExportProvider, string> = {
  wise: 'Batch transfer file, with a payment reference.',
  payoneer: 'Batch payment file for Payoneer balances.',
};

export const isExportProvider = (value: string): value is ExportProvider =>
  (EXPORT_PROVIDERS as readonly string[]).includes(value);

export const EXPORT_PROVIDER_DESCRIPTIONS: Record<ExportProvider, string> = {
  wise: 'Choose the Wise balance to pay each employee from. The recipient account is always PKR, and the amount is the locked payslip total — what the employee receives, not what Wise debits.',
  payoneer:
    'Choose the Payoneer balance to pay each employee from. The recipient bank account is always PKR, and the amount is the locked payslip total.',
};

// Unverified against Wise's docs — loosen if they allow more.
export const WISE_REFERENCE_MAX_LENGTH = 35;
