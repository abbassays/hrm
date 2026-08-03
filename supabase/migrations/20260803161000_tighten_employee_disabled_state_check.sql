-- Keep the enabled and disabled states mutually exclusive.
alter table public.employees
  drop constraint if exists employees_disabled_state_check;

alter table public.employees
  add constraint employees_disabled_state_check
  check (
    (account_status = 'disabled' and disabled_at is not null and disabled_from_status is not null and disabled_from_status <> 'disabled')
    or
    (account_status <> 'disabled' and disabled_at is null and disabled_by is null and disabled_from_status is null)
  );
