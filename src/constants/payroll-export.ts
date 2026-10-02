export const BALANCE_CURRENCIES = ['USD', 'GBP', 'EUR'] as const;

export type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number];

export const DEFAULT_BALANCE_CURRENCY: BalanceCurrency = 'USD';

export const isBalanceCurrency = (value: string): value is BalanceCurrency =>
  (BALANCE_CURRENCIES as readonly string[]).includes(value);

export const EXPORT_PROVIDERS = ['payoneer', 'wise'] as const;

export type ExportProvider = (typeof EXPORT_PROVIDERS)[number];

export const EXPORT_PROVIDER_LABELS: Record<ExportProvider, string> = {
  payoneer: 'Payoneer',
  wise: 'Wise',
};

export const isExportProvider = (value: string): value is ExportProvider =>
  (EXPORT_PROVIDERS as readonly string[]).includes(value);

// Unverified against Wise's docs — loosen if they allow more.
export const WISE_REFERENCE_MAX_LENGTH = 35;
