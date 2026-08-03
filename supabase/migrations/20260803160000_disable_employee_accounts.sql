-- Disable an employee without deleting their Auth identity, HR records, or files.
-- `account_status` remains the authoritative eligibility state used by payroll,
-- policy, and notification queries. The prior status makes re-enabling lossless.

alter table public.employees
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.employees(id) on delete set null,
  add column if not exists disabled_from_status public.account_status;

alter table public.employees
  drop constraint if exists employees_disabled_state_check;

alter table public.employees
  add constraint employees_disabled_state_check
  check (
    (account_status = 'disabled' and disabled_at is not null and disabled_from_status is not null and disabled_from_status <> 'disabled')
    or
    (account_status <> 'disabled' and disabled_at is null and disabled_by is null and disabled_from_status is null)
  );

create index if not exists employees_disabled_at_idx
  on public.employees (disabled_at)
  where disabled_at is not null;

comment on column public.employees.disabled_at is
  'When non-null, the employee cannot authenticate. Their HR history and files are retained.';
comment on column public.employees.disabled_from_status is
  'Lifecycle status to restore when an administrator re-enables the employee.';
