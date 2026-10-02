'use server';

import { toCsv } from '@/lib/payroll/csv';
import {
  loadExportPayees,
  saveSourceCurrencies,
  storeExportFile,
} from '@/lib/payroll/export-run';
import { PAYONEER_HEADER, payoneerFileName } from '@/lib/payroll/payoneer-csv';
import { toWiseCsv, wiseFileName } from '@/lib/payroll/wise-csv';
import { authActionClient } from '@/lib/server/safe-action';

import {
  exportPayoneerSchema,
  exportWiseSchema,
} from '@/schema/payroll-export';

export const exportPayoneer = authActionClient
  .schema(exportPayoneerSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { run, payees, excluded } = await loadExportPayees(ctx, parsedInput);

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
    const { run, payees, excluded } = await loadExportPayees(ctx, parsedInput);

    const dataRows = payees.map((payee) => [
      payee.holderName,
      payee.email,
      parsedInput.paymentReference,
      '',
      'PERSON',
      'target', // amount is what the recipient gets, not what we're debited
      payee.amount,
      payee.sourceCurrency,
      'PKR',
      payee.iban,
    ]);

    await saveSourceCurrencies('wise', run.id, payees);

    const file = await storeExportFile(ctx, {
      provider: 'wise',
      run,
      csv: toWiseCsv(dataRows),
      fileName: wiseFileName,
    });

    return { ...file, count: payees.length, excluded };
  });
