import { format } from 'date-fns';

export const CSV_MIME = 'text/csv';

type CsvValue = string | number;

type CsvOptions = { quoteAll?: boolean };

const csvField = (value: CsvValue, quoteAll: boolean) => {
  const text = String(value);
  return quoteAll || /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

export const toCsv = (
  rows: readonly (readonly CsvValue[])[],
  { quoteAll = false }: CsvOptions = {},
) =>
  rows
    .map((row) => row.map((value) => csvField(value, quoteAll)).join(','))
    .join('\r\n');

export const exportFileName = (
  prefix: string,
  periodMonth: string,
  copyNumber = 0,
) => {
  const month = format(periodMonth, 'MMM-yyyy').toLowerCase();
  return `${prefix}-${month}${copyNumber ? `(${copyNumber})` : ''}.csv`;
};
