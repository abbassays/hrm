-- In-app admin notifications for every source in the unified approvals queue.
-- Request inserts and onboarding submissions fan out to active admins. Keeping
-- this in database triggers ensures notifications are also created when a row
-- reaches the pending state outside the current Next.js server actions.

create or replace function public.notify_active_admins(
  p_type text,
  p_title text,
  p_body text,
  p_link text default '/admin/approvals'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (recipient_id, type, title, body, link)
  select e.id, p_type, p_title, p_body, p_link
    from public.employees e
   where e.role = 'admin'
     and e.account_status = 'active';
$$;

create or replace function public.trg_notify_admins_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_name text;
begin
  select coalesce(nullif(trim(e.full_name), ''), e.email)
    into v_employee_name
    from public.employees e
   where e.id = new.employee_id;

  perform public.notify_active_admins(
    'leave_submitted',
    'New leave request',
    coalesce(v_employee_name, 'An employee') || ' requested ' ||
      initcap(replace(new.leave_type::text, '_', ' ')) || ' leave for ' ||
      trim(to_char(new.num_days, 'FM999999990.##')) || ' day(s).'
  );

  return new;
end;
$$;

create trigger notify_admins_leave_submitted
after insert on public.leave_requests
for each row
when (new.status = 'pending')
execute function public.trg_notify_admins_leave();

create or replace function public.trg_notify_admins_medical()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_name text;
begin
  select coalesce(nullif(trim(e.full_name), ''), e.email)
    into v_employee_name
    from public.employees e
   where e.id = new.employee_id;

  perform public.notify_active_admins(
    'medical_submitted',
    'New medical claim',
    coalesce(v_employee_name, 'An employee') ||
      ' submitted a medical claim for PKR ' ||
      to_char(new.amount, 'FM999,999,999') || '.'
  );

  return new;
end;
$$;

create trigger notify_admins_medical_submitted
after insert on public.medical_claims
for each row
when (new.status = 'pending')
execute function public.trg_notify_admins_medical();

create or replace function public.trg_notify_admins_overtime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_name text;
  v_project_name text;
begin
  select coalesce(nullif(trim(e.full_name), ''), e.email)
    into v_employee_name
    from public.employees e
   where e.id = new.employee_id;

  select p.name
    into v_project_name
    from public.projects p
   where p.id = new.project_id;

  perform public.notify_active_admins(
    'overtime_submitted',
    'New overtime log',
    coalesce(v_employee_name, 'An employee') || ' logged ' ||
      trim(to_char(new.hours, 'FM999999990.##')) || ' hour(s) for ' ||
      coalesce(v_project_name, 'a project') || '.'
  );

  return new;
end;
$$;

create trigger notify_admins_overtime_submitted
after insert on public.overtime_logs
for each row
when (new.status = 'pending')
execute function public.trg_notify_admins_overtime();

create or replace function public.trg_notify_admins_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_active_admins(
    'onboarding_submitted',
    'Onboarding ready for approval',
    coalesce(nullif(trim(new.full_name), ''), new.email) ||
      ' completed onboarding and is ready for review.'
  );

  return new;
end;
$$;

create trigger notify_admins_onboarding_submitted
after update of account_status on public.employees
for each row
when (
  new.account_status = 'submitted'
  and old.account_status is distinct from new.account_status
)
execute function public.trg_notify_admins_onboarding();

-- These functions exist only for trigger execution. Prevent direct PostgREST
-- RPC calls while leaving trigger execution unaffected.
revoke execute on function public.notify_active_admins(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_leave()
  from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_medical()
  from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_overtime()
  from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_onboarding()
  from public, anon, authenticated;
