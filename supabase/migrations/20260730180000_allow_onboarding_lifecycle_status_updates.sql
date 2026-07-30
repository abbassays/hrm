-- `accept_onboarding()` and `submit_onboarding()` are SECURITY DEFINER RPCs
-- that own the invited -> onboarding -> active lifecycle. Their UPDATEs fire
-- this trigger as the function owner (`postgres`), while direct client UPDATEs
-- still run as `authenticated` and remain unable to change protected columns.
create or replace function public.guard_employee_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'postgres' and not public.is_admin() then
    if new.role is distinct from old.role
    or new.account_status is distinct from old.account_status then
      raise exception 'Not allowed to modify protected columns';
    end if;
  end if;

  return new;
end;
$$;
