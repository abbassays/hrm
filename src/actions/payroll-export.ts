'use server';

import { toCsv } from '@/lib/payroll/csv';
import {
  loadExportPayees,
  saveSourceCurrencies,
  storeExportFile,
} from '@/lib/payroll/export-run';
import { PAYONEER_HEADER, payoneerFileName } from '@/lib/payroll/payoneer-csv';
import {
  needsWiseAddress,
  toWiseCsv,
  WISE_RECIPIENT_COUNTRY,
  wiseFileName,
  wiseHeader,
} from '@/lib/payroll/wise-csv';
import { authActionClient } from '@/lib/server/safe-action';

import {
  exportPayoneerSchema,
  exportWiseSchema,
} from '@/schema/payroll-export';

export const exportPayoneer = authActionClient
  .schema(exportPayoneerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { currencyByEmployee, ...selection } = parsedInput;
    const { run, payees, excluded } = await loadExportPayees(ctx, {
      ...selection,
      sourceCurrencyFor: (employeeId) => currencyByEmployee[employeeId],
    });

    const dataRows = payees.map((payee) => [
      payee.holderName,
      payee.iban,
      payee.sourceCurrency,
      '', // Amount to Pay: Payoneer derives it from balance + FX
      payee.amount,
      'PKR',
      '',
      '',
    ]);

    await saveSourceCurrencies('payoneer', run.id, payees);

    const file = await storeExportFile(ctx, {
      provider: 'payoneer',
      run,
      csv: toCsv([[...PAYONEER_HEADER], ...dataRows]),
      fileName: payoneerFileName,
    });

    return { ...file, count: payees.length, excluded };
  });

export const exportWise = authActionClient
  .schema(exportWiseSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { sourceCurrency, paymentReference, ...selection } = parsedInput;
    // Wise takes one source currency per batch file.
    const { run, payees, excluded } = await loadExportPayees(ctx, {
      ...selection,
      sourceCurrencyFor: () => sourceCurrency,
    });

    const withAddress = needsWiseAddress(sourceCurrency);
    const missingAddress = withAddress
      ? payees.filter(
          (payee) => !payee.address || !payee.city || !payee.postalCode,
        )
      : [];
    if (missingAddress.length > 0)
      throw new Error(
        `Missing address for ${missingAddress.map((payee) => payee.employeeName).join(', ')}. Wise needs a street address, city and postal code to pay from ${sourceCurrency}.`,
      );

    const dataRows = payees.map((payee) => [
      payee.holderName,
      payee.email,
      paymentReference,
      '',
      'PERSON',
      'target', // amount is what the recipient gets, not what we're debited
      payee.amount,
      payee.sourceCurrency,
      'PKR',
      payee.iban,
      ...(withAddress
        ? [
            WISE_RECIPIENT_COUNTRY,
            payee.city,
            payee.address,
            '',
            payee.postalCode,
          ]
        : []),
    ]);

    await saveSourceCurrencies('wise', run.id, payees);

    const file = await storeExportFile(ctx, {
      provider: 'wise',
      run,
      csv: toWiseCsv(wiseHeader(sourceCurrency), dataRows),
      fileName: wiseFileName,
    });

    return { ...file, count: payees.length, excluded };
  });
