export const BALANCE_CURRENCIES = ['EUR', 'GBP', 'USD'] as const;

export type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number];

export const DEFAULT_BALANCE_CURRENCY: BalanceCurrency = 'EUR';

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
  wise: 'Everyone in this file is paid from one Wise balance and receives their locked payslip total in PKR.',
  payoneer:
    'Choose the Payoneer balance to pay each employee from. Everyone receives their locked payslip total in PKR.',
};

export const WISE_EXPORT_NOTES = [
  'Wise takes one source currency per file, so everyone in this file is paid from the same balance.',
  'The amount is what the employee receives in PKR, not what Wise debits from you.',
  'The payment reference is sent with every transfer in this file.',
  "Paying from USD adds each employee's address from their profile, because Wise requires it. Anyone with an incomplete address has to be left out or have their profile completed first.",
  'Use the icon in the In file column to leave someone out. It only affects this file.',
] as const;

// Unverified against Wise's docs — loosen if they allow more.
export const WISE_REFERENCE_MAX_LENGTH = 35;

// Wise requires the recipient's address when paying from these currencies.
export const WISE_ADDRESS_SOURCE_CURRENCIES = ['USD', 'AUD'] as const;
