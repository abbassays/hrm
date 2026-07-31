-- Refresh reopened payroll runs from the current employee configuration.
--
-- Payslips remain immutable snapshots while a run is locked. Reopening is the
-- explicit signal that the snapshot is becoming a draft again, so unlock and
-- recalculation happen in one transaction. This keeps the UI from briefly (or
-- permanently, after a failed second request) showing stale salary/config data.
--
-- The original calculator stored effective days worked and OT multiplier in
-- the same columns used for payroll-specific edits. Consequently every first
-- calculation looked like an override forever. Nullable sidecars make the
-- distinction explicit, following the existing overtime_hours_override model.

alter table payslips
  add column days_worked_override numeric(4, 1),
  add column overtime_multiplier_override numeric(4, 2),
  add constraint payslips_days_worked_override_check
    check (
      days_worked_override is null
      or (days_worked_override >= 0 and days_worked_override <= days_in_month)
    ),
  add constraint payslips_ot_multiplier_override_check
    check (
      overtime_multiplier_override is null
      or (overtime_multiplier_override >= 0 and overtime_multiplier_override <= 9.99)
    );

comment on column payslips.days_worked_override is
  'Admin override for days worked. Null = derive from the run and approved unpaid leave.';

comment on column payslips.overtime_multiplier_override is
  'Admin override for the run. Null = use the current employee override or company default.';

create or replace function calculate_payroll(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run       payroll_runs%rowtype;
  v_mult_def  numeric(4,2);
  v_tax_rate  numeric(5,2);
  r           record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Serialize calculate/finalize/reopen operations for the same run.
  select * into v_run from payroll_runs where id = p_run_id for update;
  if not found then raise exception 'run % not found', p_run_id; end if;
  if v_run.status = 'locked' then
    raise exception 'run % is locked', p_run_id using errcode = '55000';
  end if;

  select ot_multiplier_default, tax_rate_percent
    into v_mult_def, v_tax_rate
    from payroll_settings where id = true;

  -- Recalculation is also membership reconciliation. Do not retain a stale
  -- payslip for a deleted/inactive/unconfigured employee after a run is reopened.
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
           coalesce((select sum(m.amount) from medical_claims m
                     where m.employee_id = e.id and m.status = 'approved'
                       and m.payroll_run_id is null
                       and date_trunc('month', m.expense_date) = date_trunc('month', v_run.period_month)
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
      v_ot_hours     := coalesce(v_ot_override, r.ot_hours);
      v_custom       := coalesce(v_custom, '[]'::jsonb);

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

      -- Sidecar override columns are deliberately omitted: inserts use null
      -- and conflict updates retain only overrides an admin explicitly set.
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
        -- A recalculated/reopened payslip is a new draft. A previous successful
        -- delivery must not imply that this version was sent.
        notification_status = 'pending',
        notification_sent_at = null,
        notification_last_error = null;
    end;
  end loop;
end;
$$;
revoke all on function calculate_payroll(uuid) from public, anon;
grant execute on function calculate_payroll(uuid) to authenticated;

create or replace function lock_payroll(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- Always freeze a calculation made from the latest employee configuration.
  -- Explicit per-run overrides survive through their nullable sidecars.
  perform calculate_payroll(p_run_id);

  update overtime_logs o set payroll_run_id = p_run_id
   where o.status = 'approved' and o.payroll_run_id is null
     and date_trunc('month', o.work_date) = date_trunc('month', v_run.period_month)
     and o.employee_id in (select employee_id from payslips where payroll_run_id = p_run_id);

  update medical_claims m set payroll_run_id = p_run_id
   where m.status = 'approved' and m.payroll_run_id is null
     and date_trunc('month', m.expense_date) = date_trunc('month', v_run.period_month)
     and m.employee_id in (select employee_id from payslips where payroll_run_id = p_run_id);

  select coalesce(sum(total_pay), 0) into v_total
    from payslips where payroll_run_id = p_run_id;

  update payroll_runs
     set status = 'locked', total_payroll = v_total,
         locked_by = auth.uid(), locked_at = now()
   where id = p_run_id;
end;
$$;
revoke all on function lock_payroll(uuid) from public, anon;
grant execute on function lock_payroll(uuid) to authenticated;

create or replace function unlock_payroll(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  update medical_claims set payroll_run_id = null where payroll_run_id = p_run_id;

  update payroll_runs
     set status = 'open', total_payroll = null,
         locked_by = null, locked_at = null
   where id = p_run_id;

  -- The status flip, item release, and snapshot refresh are atomic. If the
  -- calculation fails, the run remains fully locked rather than half-reopened.
  perform calculate_payroll(p_run_id);
end;
$$;
revoke all on function unlock_payroll(uuid) from public, anon;
grant execute on function unlock_payroll(uuid) to authenticated;
