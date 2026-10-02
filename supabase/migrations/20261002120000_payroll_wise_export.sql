-- Wise batch-payment export, alongside the existing Payoneer one.
-- Spec: docs/product/wise-export-spec.md §2.

-- Every export written so far was Payoneer, so the default backfills correctly.
alter table payroll_exports
  add column provider text not null default 'payoneer'
  constraint payroll_exports_provider_check check (provider in ('payoneer', 'wise'));

-- Kept apart from `currency_balance`, which records the Payoneer balance and is
-- already populated for past runs; a Wise re-export must not rewrite it.
alter table payslips
  add column wise_source_currency text;
