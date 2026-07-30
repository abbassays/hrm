-- Onboarding now activates an employee immediately after the final consent
-- step. There is no submitted/review state, admin decision, or completion email.

-- Stop creating onboarding approval notifications before migrating rows.
drop trigger if exists notify_admins_onboarding_submitted
  on public.employees;
drop function if exists public.trg_notify_admins_onboarding();

-- Remove now-obsolete unread/read admin notifications from the former flow.
delete from public.notifications
where type = 'onboarding_submitted';

-- Existing employees waiting for review must not be stranded when the state is
-- removed. Activate them and mirror the new status into their next JWT.
-- The employee-column guard deliberately protects account_status from ordinary
-- writes. Scope its established bypass to this migration transaction only.
select set_config('app.bypass_employee_guard', 'on', true);

with activated as (
  update public.employees
     set account_status = 'active',
         activated_at = coalesce(activated_at, now())
   where account_status = 'submitted'
  returning id
)
update auth.users as auth_user
   set raw_app_meta_data =
       coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('account_status', 'active')
  from activated
 where auth_user.id = activated.id;

-- Admin dashboard: onboarding no longer contributes to pending approvals.
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'pending_leave',
      (select count(*) from public.leave_requests where status = 'pending'),
    'pending_medical',
      (select count(*) from public.medical_claims where status = 'pending'),
    'pending_overtime',
      (select count(*) from public.overtime_logs where status = 'pending'),
    'active_employees',
      (select count(*)
         from public.employees
        where account_status = 'active'
          and role = 'employee'),
    'payroll_cycle',
      (select status
         from public.payroll_runs
        order by period_month desc
        limit 1)
  );
end;
$function$;

-- Admin approvals now contains only leave, medical, and overtime requests.
create or replace function public.pending_approvals()
returns table (
  kind          text,
  item_id       uuid,
  employee_id   uuid,
  employee_name text,
  summary       text,
  amount        int,
  submitted_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select
      'leave'::text as kind,
      leave_request.id as item_id,
      leave_request.employee_id,
      employee.full_name as employee_name,
      initcap(replace(leave_request.leave_type::text, '_', ' '))
        || ' · ' || trim_scale(leave_request.num_days)::text || 'd' as summary,
      null::int as amount,
      leave_request.created_at as submitted_at
    from public.leave_requests as leave_request
    join public.employees as employee
      on employee.id = leave_request.employee_id
    where leave_request.status = 'pending'

  union all

    select
      'medical'::text,
      medical_claim.id,
      medical_claim.employee_id,
      employee.full_name,
      initcap(replace(medical_claim.service_type::text, '_', ' ')),
      medical_claim.amount,
      medical_claim.created_at
    from public.medical_claims as medical_claim
    join public.employees as employee
      on employee.id = medical_claim.employee_id
    where medical_claim.status = 'pending'

  union all

    select
      'overtime'::text,
      overtime_log.id,
      overtime_log.employee_id,
      employee.full_name,
      trim_scale(overtime_log.hours)::text || 'h overtime',
      null::int,
      overtime_log.created_at
    from public.overtime_logs as overtime_log
    join public.employees as employee
      on employee.id = overtime_log.employee_id
    where overtime_log.status = 'pending'

  order by submitted_at desc, item_id desc;
end;
$function$;

revoke all on function public.pending_approvals() from public, anon;
grant execute on function public.pending_approvals() to authenticated;

-- Recreate both lifecycle functions after the enum swap so neither can retain
-- a dependency on the retired enum type from an older database migration.
drop function if exists public.accept_onboarding();
drop function if exists public.submit_onboarding();

-- This trigger depends on the account_status column type. Preserve its
-- role/status JWT mirroring behavior across the enum replacement below.
drop trigger if exists trg_employees_mirror_role on public.employees;

-- PostgreSQL enum values cannot be removed in place. All submitted rows were
-- migrated above, so recreate the type with only reachable lifecycle states.
alter table public.employees
  alter column account_status drop default;

alter type public.account_status rename to account_status_with_review;

create type public.account_status as enum (
  'invited',
  'onboarding',
  'active'
);

alter table public.employees
  alter column account_status type public.account_status
  using account_status::text::public.account_status;

alter table public.employees
  alter column account_status set default 'invited'::public.account_status;

drop type public.account_status_with_review;

alter table public.employees
  drop column if exists review_note;

create trigger trg_employees_mirror_role
after insert or update of role, account_status on public.employees
for each row execute function public.mirror_role_to_jwt();

-- Caller-only, idempotent invite acceptance.
create function public.accept_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  employee_id uuid := auth.uid();
  current_status public.account_status;
begin
  if employee_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select account_status
    into current_status
    from public.employees
   where id = employee_id
     and role = 'employee'
   for update;

  if not found then
    raise exception 'employee not found' using errcode = 'P0002';
  end if;

  if current_status = 'invited' then
    update public.employees
       set account_status = 'onboarding',
           accepted_at = coalesce(accepted_at, now())
     where id = employee_id;
  elsif current_status <> 'onboarding' then
    raise exception 'invitation cannot be accepted from status %',
      current_status
      using errcode = '55000';
  end if;

  update auth.users
     set raw_app_meta_data =
         coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('account_status', 'onboarding')
   where id = employee_id;
end;
$function$;

revoke all on function public.accept_onboarding() from public, anon;
grant execute on function public.accept_onboarding() to authenticated;

-- Caller-only, idempotent completion. The auth metadata write is explicit so
-- the client can refresh its token and pass middleware immediately, independent
-- of any legacy metadata-mirroring trigger in the deployed database.
create function public.submit_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  employee_id uuid := auth.uid();
  current_status public.account_status;
begin
  if employee_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select account_status
    into current_status
    from public.employees
   where id = employee_id
     and role = 'employee'
   for update;

  if not found then
    raise exception 'employee not found' using errcode = 'P0002';
  end if;

  if current_status = 'onboarding' then
    update public.employees
       set account_status = 'active',
           consent_at = now(),
           activated_at = coalesce(activated_at, now())
     where id = employee_id;
  elsif current_status <> 'active' then
    raise exception 'onboarding cannot be completed from status %',
      current_status
      using errcode = '55000';
  end if;

  update auth.users
     set raw_app_meta_data =
         coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('account_status', 'active')
   where id = employee_id;
end;
$function$;

revoke all on function public.submit_onboarding() from public, anon;
grant execute on function public.submit_onboarding() to authenticated;
