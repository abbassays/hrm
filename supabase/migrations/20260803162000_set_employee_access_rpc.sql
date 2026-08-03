-- The protected-column trigger intentionally rejects direct API updates to
-- account_status. This narrowly-scoped admin RPC owns the disable/enable
-- transition and runs as the database owner.
create or replace function public.set_employee_access(
  p_employee_id uuid,
  p_disabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_employee
    from public.employees
   where id = p_employee_id
   for update;

  if not found then
    raise exception 'employee not found' using errcode = 'P0002';
  end if;
  if v_employee.role <> 'employee' then
    raise exception 'administrator accounts cannot be changed here' using errcode = '42501';
  end if;

  if p_disabled then
    if v_employee.account_status = 'disabled' then
      raise exception 'employee is already disabled' using errcode = '55000';
    end if;

    update public.employees
       set account_status = 'disabled',
           disabled_at = now(),
           disabled_by = auth.uid(),
           disabled_from_status = v_employee.account_status
     where id = p_employee_id;
  else
    if v_employee.account_status <> 'disabled'
       or v_employee.disabled_from_status is null then
      raise exception 'employee is not disabled' using errcode = '55000';
    end if;

    update public.employees
       set account_status = v_employee.disabled_from_status,
           disabled_at = null,
           disabled_by = null,
           disabled_from_status = null
     where id = p_employee_id;
  end if;
end;
$$;

revoke all on function public.set_employee_access(uuid, boolean) from public, anon;
grant execute on function public.set_employee_access(uuid, boolean) to authenticated;
