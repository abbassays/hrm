-- Medical claims: track whether a claim has been PAID, separately from whether
-- it was approved.
--
-- The bug this fixes: payroll decided which run pays a claim by matching the
-- run's month against the claim's EXPENSE date:
--
--   date_trunc('month', m.expense_date) = date_trunc('month', run.period_month)
--
-- So a claim for an expense on 27 July, approved in August, matches nothing.
-- The August run wants August expense dates; the July run is locked and refuses
-- to recalculate. The claim is approved and permanently unpayable. Four of
-- Manahil's 2025 claims were already stranded this way, pointing at runs that
-- were never created.
--
-- Approval and payment are two different events and the schema only modelled
-- one. `payroll_run_id` was doing double duty as "has this been paid", which
-- breaks down the moment something is settled outside a payroll run.
--
-- A dedicated enum rather than a new value on `request_status`: that type is
-- shared with leave_requests and overtime_logs, where "paid" is meaningless,
-- and `leave_type` already has a value called 'paid'. Two different meanings of
-- 'paid' in one domain is a trap.
--
-- Matching now runs on "approved, not yet paid, and approved before this run
-- closes" — which is what the Medical Allowance Policy §5 already says:
-- "Approved reimbursements will be processed in the next salary cycle."

create type public.medical_payment_status as enum ('unpaid', 'paid');

alter table public.medical_claims
  add column if not exists payment_status public.medical_payment_status
    not null default 'unpaid',
  add column if not exists paid_at timestamptz;

comment on column public.medical_claims.payment_status is
  'Whether the claim has been reimbursed. Independent of `status`, which is the '
  'review decision. A claim can be approved for weeks before it is paid.';
comment on column public.medical_claims.paid_at is
  'When the claim was reimbursed. Set by lock_payroll(), or manually for claims '
  'settled outside the platform.';

create index if not exists medical_claims_unpaid_idx
  on public.medical_claims (employee_id)
  where payment_status = 'unpaid' and status = 'approved';

-- ---------------------------------------------------------------------------
-- calculate_payroll: sweep by "approved and unpaid", not by expense month.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_payroll(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run       payroll_runs%rowtype;
  v_mult_def  numeric(4,2);
  v_tax_rate  numeric(5,2);
  r           record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_run from payroll_runs where id = p_run_id for update;
  if not found then raise exception 'run % not found', p_run_id; end if;
  if v_run.status = 'locked' then
    raise exception 'run % is locked', p_run_id using errcode = '55000';
  end if;

  select ot_multiplier_default, tax_rate_percent
    into v_mult_def, v_tax_rate
    from payroll_settings where id = true;

  delete from payslips p
   where p.payroll_run_id = p_run_id
     and not exists (
       select 1
         from employees e
         join employment_details ed on ed.employee_id = e.id
        where e.id = p.employee_id
          and e.account_status = 'active'
          and ed.base_salary is not null
     );

  for r in
    select e.id as employee_id,
           ed.base_salary,
           ed.designation,
           coalesce(nullif(ed.working_hours, 0), 160) as working_hours,
           coalesce(ed.ot_multiplier_override, v_mult_def) as multiplier,
           coalesce((select sum(l.num_days) from leave_requests l
                     where l.employee_id = e.id and l.status = 'approved'
                       and l.leave_type = 'unpaid'
                       and date_trunc('month', l.start_date) = date_trunc('month', v_run.period_month)
                    ), 0) as unpaid_days,
           coalesce((select sum(o.hours) from overtime_logs o
                     where o.employee_id = e.id and o.status = 'approved'
                       and o.payroll_run_id is null
                       and date_trunc('month', o.work_date) = date_trunc('month', v_run.period_month)
                    ), 0) as ot_hours,
           -- Any approved claim that has not been reimbursed yet and was
           -- approved before this run's month ends. No expense-date matching:
           -- a July expense approved in August belongs in the August run.
           coalesce((select sum(m.amount) from medical_claims m
                     where m.employee_id = e.id and m.status = 'approved'
                       and m.payment_status = 'unpaid'
                       and m.payroll_run_id is null
                       and coalesce(m.reviewed_at, m.created_at)
                             < (date_trunc('month', v_run.period_month) + interval '1 month')
                    ), 0) as claims_sum
      from employees e
      join employment_details ed on ed.employee_id = e.id
     where e.account_status = 'active' and ed.base_salary is not null
  loop
    declare
      v_days_worked   numeric(4,1);
      v_multiplier    numeric(4,2);
      v_ot_hours      numeric(6,2);
      v_total_base    integer;
      v_ot_rate       numeric(12,2);
      v_ot_pay        integer;
      v_medical       integer;
      v_tax           integer;
      v_total_pay     integer;
      v_days_override numeric(4,1);
      v_mult_override numeric(4,2);
      v_ot_override   numeric(6,2);
      v_custom        jsonb;
      v_custom_total  numeric;
      v_positive_adj  numeric;
    begin
      select days_worked_override, overtime_multiplier_override,
             overtime_hours_override, custom_fields
        into v_days_override, v_mult_override, v_ot_override, v_custom
        from payslips
       where payroll_run_id = p_run_id and employee_id = r.employee_id;

      v_days_worked := coalesce(v_days_override, v_run.days_in_month - r.unpaid_days);
      v_multiplier  := coalesce(v_mult_override, r.multiplier);
      v_ot_hours    := coalesce(v_ot_override, r.ot_hours);
      v_custom      := coalesce(v_custom, '[]'::jsonb);

      v_total_base := round(r.base_salary * v_days_worked / v_run.days_in_month);
      v_ot_rate    := r.base_salary * v_multiplier / r.working_hours;
      v_ot_pay     := round(v_ot_rate * v_ot_hours);
      v_medical    := r.claims_sum;

      select coalesce(sum((item->>'amount')::numeric), 0),
             coalesce(sum((item->>'amount')::numeric)
                        filter (where (item->>'amount')::numeric > 0), 0)
        into v_custom_total, v_positive_adj
        from jsonb_array_elements(v_custom) as t(item);

      v_tax := round((r.base_salary + v_medical + v_ot_pay + v_positive_adj)
                     * v_tax_rate / 100);
      v_total_pay := round(v_total_base + v_medical + v_ot_pay + v_custom_total - v_tax);

      insert into payslips (payroll_run_id, employee_id, base_salary, days_in_month,
        days_worked, unpaid_leave_days, total_base, medical,
        overtime_hours, overtime_rate, overtime_pay, overtime_multiplier,
        designation, custom_fields, tax_deduction, total_pay)
      values (p_run_id, r.employee_id, r.base_salary, v_run.days_in_month,
        v_days_worked, r.unpaid_days, v_total_base, v_medical,
        v_ot_hours, v_ot_rate, v_ot_pay, v_multiplier,
        r.designation, v_custom, v_tax, v_total_pay)
      on conflict (payroll_run_id, employee_id) do update set
        base_salary = excluded.base_salary,
        days_worked = excluded.days_worked,
        unpaid_leave_days = excluded.unpaid_leave_days,
        total_base = excluded.total_base,
        medical = excluded.medical,
        overtime_hours = excluded.overtime_hours,
        overtime_rate = excluded.overtime_rate,
        overtime_pay = excluded.overtime_pay,
        overtime_multiplier = excluded.overtime_multiplier,
        designation = excluded.designation,
        custom_fields = excluded.custom_fields,
        tax_deduction = excluded.tax_deduction,
        total_pay = excluded.total_pay,
        notification_status = 'pending',
        notification_sent_at = null,
        notification_last_error = null;
    end;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- lock_payroll: stamp the claims it pays as paid.
-- ---------------------------------------------------------------------------
create or replace function public.lock_payroll(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run   payroll_runs%rowtype;
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_run from payroll_runs where id = p_run_id for update;
  if not found then raise exception 'run % not found', p_run_id; end if;
  if v_run.status = 'locked' then
    raise exception 'run % already locked', p_run_id using errcode = '55000';
  end if;

  perform calculate_payroll(p_run_id);

  update overtime_logs o set payroll_run_id = p_run_id
   where o.status = 'approved' and o.payroll_run_id is null
     and date_trunc('month', o.work_date) = date_trunc('month', v_run.period_month)
     and o.employee_id in (select employee_id from payslips where payroll_run_id = p_run_id);

  update medical_claims m
     set payroll_run_id = p_run_id,
         payment_status = 'paid',
         paid_at = now()
   where m.status = 'approved'
     and m.payment_status = 'unpaid'
     and m.payroll_run_id is null
     and coalesce(m.reviewed_at, m.created_at)
           < (date_trunc('month', v_run.period_month) + interval '1 month')
     and m.employee_id in (select employee_id from payslips where payroll_run_id = p_run_id);

  select coalesce(sum(total_pay), 0) into v_total
    from payslips where payroll_run_id = p_run_id;

  update payroll_runs
     set status = 'locked', total_payroll = v_total,
         locked_by = auth.uid(), locked_at = now()
   where id = p_run_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- unlock_payroll: releasing a claim must also mark it unpaid again, or it would
-- be released from the run yet still count as reimbursed and never be paid.
-- ---------------------------------------------------------------------------
create or replace function public.unlock_payroll(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run payroll_runs%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_run from payroll_runs where id = p_run_id for update;
  if not found then raise exception 'run % not found', p_run_id; end if;
  if v_run.status <> 'locked' then
    raise exception 'run % is not locked', p_run_id using errcode = '55000';
  end if;

  update overtime_logs set payroll_run_id = null where payroll_run_id = p_run_id;
  update medical_claims
     set payroll_run_id = null, payment_status = 'unpaid', paid_at = null
   where payroll_run_id = p_run_id;

  update payroll_runs
     set status = 'open', total_payroll = null,
         locked_by = null, locked_at = null
   where id = p_run_id;

  perform calculate_payroll(p_run_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Backfill: every existing claim has been reimbursed except Kashif's 4,810,
-- which is still pending review (Ali, 2026-08-08). Claims already linked to a
-- run take that run's lock time; the four of Manahil's settled outside the
-- platform in 2025 are stamped at their expense date.
-- ---------------------------------------------------------------------------
update public.medical_claims m
   set payment_status = 'paid',
       paid_at = coalesce(
         (select r.locked_at from public.payroll_runs r where r.id = m.payroll_run_id),
         m.expense_date::timestamptz
       )
 where m.status = 'approved';
