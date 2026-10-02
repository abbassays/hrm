drop extension if exists "pg_net";

drop policy "sysconfig_read" on "public"."system_config";

drop policy "sysconfig_write" on "public"."system_config";

alter table "public"."employee_documents" drop constraint "employee_documents_doc_type_check";

alter table "public"."employees" drop constraint "employees_auth_user_fkey";

alter table "public"."medical_claims" drop constraint "medical_claims_run_fk";

alter table "public"."overtime_logs" drop constraint "overtime_logs_run_fk";

alter table "public"."employees" add constraint "employees_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."employees" validate constraint "employees_id_fkey";

alter table "public"."medical_claims" add constraint "medical_claims_run_fk" FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL not valid;

alter table "public"."medical_claims" validate constraint "medical_claims_run_fk";

alter table "public"."overtime_logs" add constraint "overtime_logs_run_fk" FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE SET NULL not valid;

alter table "public"."overtime_logs" validate constraint "overtime_logs_run_fk";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.accept_onboarding()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_policy(p_title text, p_category public.policy_category, p_body_html text)
 RETURNS public.policies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slug text := case p_category
    when 'leave' then 'leave-policy'
    when 'medical' then 'medical-policy'
    when 'overtime' then 'overtime-policy'
    when 'general' then 'code-of-conduct'
  end;
  v_row policies;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into policies (title, slug, category)
  values (p_title, v_slug, p_category)
  returning * into v_row;

  insert into policy_versions (policy_id, version, body_html, is_active)
  values (v_row.id, 1, p_body_html, true);

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.employees_by_status()
 RETURNS TABLE(status text, count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select e.account_status::text, count(*)::int
    from employees e
    group by e.account_status;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.employees_near_medical_cap(threshold integer DEFAULT 45000)
 RETURNS TABLE(employee_id uuid, full_name text, spent integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select e.id, e.full_name, (mb).spent
    from employees e, lateral medical_balance(e.id) mb
    where e.account_status = 'active' and (mb).spent >= threshold;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_max_medical_files()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (select count(*) from public.medical_claim_files where claim_id = new.claim_id) >= 5 then
    raise exception 'A medical claim can have at most 5 proof files';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.ensure_current_run()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_month date := date_trunc('month', now())::date;
  v_id    uuid;
begin
  insert into payroll_runs (period_month, days_in_month, status)
  values (v_month,
          extract(day from (v_month + interval '1 month - 1 day'))::int,
          'open')
  on conflict (period_month) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from payroll_runs where period_month = v_month;
  end if;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.guard_employee_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_user <> 'postgres' and not public.is_admin() then
    if new.role is distinct from old.role
    or new.account_status is distinct from old.account_status then
      raise exception 'Not allowed to modify protected columns';
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$function$
;

CREATE OR REPLACE FUNCTION public.leave_balance(p_employee uuid, p_year integer DEFAULT (EXTRACT(year FROM now()))::integer)
 RETURNS TABLE(pool_total integer, used numeric, remaining numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with settings as (
    select coalesce(max(leave_pool_days), 22) as pool
    from public.payroll_settings
    where id = true
  ),
  resolved as (
    select coalesce(
      (select leave_pool_days_override
         from public.employment_details
        where employee_id = p_employee),
      (select pool from settings)
    ) as pool
  )
  select
    (select pool from resolved) as pool_total,
    coalesce(sum(num_days), 0) as used,
    (select pool from resolved) - coalesce(sum(num_days), 0) as remaining
  from public.leave_requests
  where employee_id = p_employee
    and status = 'approved'
    and leave_type in ('paid', 'sick', 'half_day')
    and extract(year from start_date) = p_year
$function$
;

CREATE OR REPLACE FUNCTION public.leave_balances_all(year integer DEFAULT (EXTRACT(year FROM now()))::integer)
 RETURNS TABLE(employee_id uuid, full_name text, remaining numeric, used numeric, pool integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select e.id, e.full_name, (lb).remaining, (lb).used, (lb).pool_total
      from employees e,
           lateral leave_balance(e.id, year) lb
     where e.account_status = 'active'
     order by e.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mirror_role_to_jwt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update auth.users
     set raw_app_meta_data =
         coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object(
              'role', new.role::text,
              'account_status', new.account_status::text
            )
   where id = new.id;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notify_active_admins(p_type text, p_title text, p_body text, p_link text DEFAULT '/admin/approvals'::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.notifications (recipient_id, type, title, body, link)
  select e.id, p_type, p_title, p_body, p_link
    from public.employees e
   where e.role = 'admin'
     and e.account_status = 'active';
$function$
;

CREATE OR REPLACE FUNCTION public.payroll_cycle_cost(run_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(sum(p.total_pay), 0)::int
    into v_total
    from payslips p
   where p.payroll_run_id = run_id;

  return v_total;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pending_approvals()
 RETURNS TABLE(kind text, item_id uuid, employee_id uuid, employee_name text, summary text, amount integer, submitted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.policy_compliance()
 RETURNS TABLE(policy_id uuid, title text, policy_version_id uuid, version integer, employee_id uuid, full_name text, acknowledged boolean, acknowledged_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select p.id,
           p.title,
           pv.id,
           pv.version,
           e.id,
           coalesce(nullif(btrim(e.full_name), ''), e.email),
           (a.id is not null),
           a.acknowledged_at
      from policies p
      join policy_versions pv
        on pv.policy_id = p.id
       and pv.is_active
      cross join employees e
      left join policy_acknowledgments a
        on a.policy_version_id = pv.id
       and a.employee_id = e.id
     where e.account_status = 'active'
     order by p.title, coalesce(nullif(btrim(e.full_name), ''), e.email);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.publish_policy_version(p_policy_id uuid, p_body_html text)
 RETURNS public.policy_versions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_next int;
  v_row  policy_versions;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from policies where id = p_policy_id for update;
  if not found then
    raise exception 'policy not found' using errcode = 'P0002';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from policy_versions where policy_id = p_policy_id;

  update policy_versions
     set is_active = false
   where policy_id = p_policy_id and is_active;

  insert into policy_versions (policy_id, version, body_html, is_active)
  values (p_policy_id, v_next, p_body_html, true)
  returning * into v_row;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.run_is_locked(p_run_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from payroll_runs where id = p_run_id and status = 'locked'
  )
$function$
;

CREATE OR REPLACE FUNCTION public.set_employee_access(p_employee_id uuid, p_disabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_payslip_period_month()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.period_month is null then
    select period_month into new.period_month
      from public.payroll_runs where id = new.payroll_run_id;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_onboarding()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trg_notify_admins_leave()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trg_notify_admins_medical()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trg_notify_admins_overtime()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.trg_notify_policy_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_title text;
begin
  if new.is_active then
    select 'Policy updated: ' || p.title
      into v_title
      from policies p
     where p.id = new.policy_id;

    insert into notifications (recipient_id, type, title, body, link)
    select e.id,
           'policy_updated',
           coalesce(v_title, 'A policy was updated'),
           'A new version was published. Please review and acknowledge.',
           '/policies'
      from employees e
     where e.account_status = 'active';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upload_contract(p_employee_id uuid, p_storage_path text, p_file_name text, p_note text DEFAULT NULL::text)
 RETURNS public.contracts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_next     int;
  v_uploader uuid;
  v_row      contracts;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1 from employees where id = p_employee_id for update;
  if not found then
    raise exception 'employee not found' using errcode = 'P0002';
  end if;

  -- Every admin on this project has an employees row, but the lookup keeps the
  -- FK safe for one that doesn't (attribution is nulled, the upload succeeds).
  select id into v_uploader from employees where id = auth.uid();

  select coalesce(max(version), 0) + 1 into v_next
    from contracts where employee_id = p_employee_id;

  update contracts
     set is_active = false
   where employee_id = p_employee_id and is_active;

  insert into contracts (
    employee_id, version, storage_path, file_name, note, is_active, uploaded_by
  )
  values (
    p_employee_id, v_next, p_storage_path, p_file_name,
    nullif(btrim(p_note), ''), true, v_uploader
  )
  returning * into v_row;

  return v_row;
end;
$function$
;


  create policy "sysconfig_read"
  on "public"."system_config"
  as permissive
  for select
  to public
using (true);



  create policy "sysconfig_write"
  on "public"."system_config"
  as permissive
  for update
  to public
using (public.is_admin())
with check (public.is_admin());



