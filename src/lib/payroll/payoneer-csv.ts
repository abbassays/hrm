import { format } from 'date-fns';

/** The exact Payoneer bulk-payment template header row (from the
 * `june_salaries` reference). Order and wording are load-bearing — Payoneer
 * matches columns by header, so do not reword or reorder. `Amount to Pay`
 * (source-currency amount) is intentionally left blank; Payoneer derives it
 * from the balance + FX. */
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

export const PAYONEER_CSV_MIME = 'text/csv';

/** One RFC 4180 field: quote only when the value carries a comma, quote or
 * newline, and double any embedded quote. Employee names and account holders
 * are free text, so the bit that actually has to be right is escaping an
 * unescaped comma in a name. */
const csvField = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Array-of-arrays → CSV text, CRLF row endings per RFC 4180. No UTF-8 BOM:
 * Payoneer matches its first header exactly, and a BOM would alter it. */
export const toCsv = (rows: readonly (readonly (string | number)[])[]) =>
  rows.map((row) => row.map(csvField).join(',')).join('\r\n');

/**
 * `salaries-jul-2026.csv` for the first export of a payroll run. Repeated
 * exports use Word-style copy names: `salaries-jul-2026(1).csv`, then `(2)`.
 *
 * @param periodMonth the run's first-of-month `YYYY-MM-DD` date
 * @param copyNumber zero for the original name; later copies use `(1)`, `(2)`,
 * and so on
 */
export const payoneerFileName = (periodMonth: string, copyNumber = 0) => {
  const month = format(periodMonth, 'MMM-yyyy').toLowerCase();
  return `salaries-${month}${copyNumber ? `(${copyNumber})` : ''}.csv`;
};
