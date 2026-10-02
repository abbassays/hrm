'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  BALANCE_CURRENCIES,
  type BalanceCurrency,
  DEFAULT_BALANCE_CURRENCY,
} from '@/constants/payroll-export';

import { type PayrollExportRow } from '@/types/hrm';

const toggled = (ids: Set<string>, id: string) => {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export function useExportCurrencySelection(rows: PayrollExportRow[]) {
  const [currencies, setCurrencies] = useState<Record<string, BalanceCurrency>>(
    {},
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [bulkCurrency, setBulkCurrency] = useState<BalanceCurrency>(
    DEFAULT_BALANCE_CURRENCY,
  );

  const currencyFor = (employeeId: string) =>
    currencies[employeeId] ?? DEFAULT_BALANCE_CURRENCY;

  const toggleExcluded = (employeeId: string) =>
    setExcludedIds((prev) => toggled(prev, employeeId));

  const toggleSelected = (employeeId: string) =>
    setSelectedIds((prev) => toggled(prev, employeeId));

  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map((row) => row.employeeId)),
    );

  const setCurrencyFor = (employeeId: string, currency: BalanceCurrency) =>
    setCurrencies((prev) => ({ ...prev, [employeeId]: currency }));

  const applyBulkCurrency = () => {
    setCurrencies((prev) => {
      const next = { ...prev };
      selectedIds.forEach((employeeId) => {
        next[employeeId] = bulkCurrency;
      });
      return next;
    });
    toast.success(
      `Set ${bulkCurrency} for ${selectedIds.size} ${
        selectedIds.size === 1 ? 'employee' : 'employees'
      }`,
    );
  };

  const reset = () => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  const includedRows = rows.filter((row) => !excludedIds.has(row.employeeId));

  // Excluded people are paid from no balance in this file, so they're left out.
  const breakdown = BALANCE_CURRENCIES.map((currency) => {
    const inCurrency = includedRows.filter(
      (row) => currencyFor(row.employeeId) === currency,
    );
    return {
      currency,
      count: inCurrency.length,
      totalPkr: inCurrency.reduce((sum, row) => sum + row.total, 0),
    };
  }).filter((group) => group.count > 0);

  const currencyByEmployee = Object.fromEntries(
    rows.map((row) => [row.employeeId, currencyFor(row.employeeId)]),
  );

  return {
    selectedIds,
    excludedIds,
    bulkCurrency,
    includedRows,
    breakdown,
    currencyByEmployee,
    allSelected: rows.length > 0 && selectedIds.size === rows.length,
    currencyFor,
    setBulkCurrency,
    setCurrencyFor,
    toggleSelected,
    toggleExcluded,
    toggleAll,
    applyBulkCurrency,
    reset,
  };
}

export type ExportCurrencySelection = ReturnType<
  typeof useExportCurrencySelection
>;
