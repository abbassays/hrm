-- medical_balance(): make the allowance replenish after it is spent.
--
-- The previous definition derived entitlement from tenure alone:
--
--   accrued   = least(cap, monthly * months_since_activation)
--   spent     = sum of every approved claim, ever
--   available = greatest(0, accrued - spent)
--
-- Nothing in `accrued` referenced spending, so once an employee passed
-- cap / monthly months (10 at the default 50,000 / 5,000) it was pinned at the
-- cap forever. That silently turned the cap into a LIFETIME entitlement: an
-- employee who claimed 50,000 in their first year sat at zero available for the
-- rest of their employment, no matter how long they stayed.
--
-- The actual policy is a replenishing balance with a ceiling:
--
--   on activation:  balance = 0
--   each month:     balance = min(cap, balance + monthly)
--   on a claim:     balance = balance - amount
--
-- Spending frees up room, accrual resumes the following month, and the balance
-- never holds more than the cap at any one moment. Lifetime claims may exceed
-- the cap -- that is the point, and it is why this cannot be expressed as the
-- old closed form. Replenishment depends on how accruals and claims interleave
-- over time, so the balance has to be walked month by month across the claim
-- history.
--
-- `accrued` is redefined as the amount actually credited over the employee's
-- lifetime (capped increments, summed), which keeps `available = accrued -
-- spent` true as an identity and makes the number explainable: earned X, spent
-- Y, may hold at most `cap` at once. Nothing renders `accrued` today -- the
-- balance cards show available / spent / cap -- so the change is invisible in
-- the UI while making the API coherent.
--
-- Unchanged on purpose: the signature (same five columns, so `create or
-- replace` is legal and grants survive), STABLE volatility, SECURITY INVOKER
-- with `search_path = ''` (RLS on medical_claims still decides whose claims are
-- visible), and the cap / monthly resolution order (per-employee override on
-- employment_details, else the global payroll_settings row, else the built-in
-- defaults).
--
-- Claims are bucketed by `expense_date` -- when the cost was actually incurred,
-- which is the date the balance should have moved -- not by `reviewed_at`.
-- Claims dated before activation, or in the future, clamp into the first and
-- last period respectively rather than being dropped.

create or replace function public.medical_balance(p_employee uuid)
returns table (
  accrued         int,
  spent           int,
  available       int,
  cap             int,
  monthly_accrual int
)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_cap      int;
  v_monthly  int;
  v_start    timestamptz;
  v_months   int;
  v_balance  int := 0;
  v_credited int := 0;
  v_spent    int := 0;
  v_credit   int;
  v_period   int;
  v_amount   int;
  v_spend    int[];
begin
  v_cap := coalesce(
    (select ed.medical_cap_override
       from public.employment_details ed
      where ed.employee_id = p_employee),
    (select ps.medical_cap from public.payroll_settings ps where ps.id = true),
    50000
  );

  v_monthly := coalesce(
    (select ed.medical_accrual_monthly_override
       from public.employment_details ed
      where ed.employee_id = p_employee),
    (select ps.medical_accrual_monthly from public.payroll_settings ps where ps.id = true),
    5000
  );

  select coalesce(e.activated_at, e.created_at)
    into v_start
    from public.employees e
   where e.id = p_employee;

  -- Unknown employee: report the resolved policy, no entitlement.
  if v_start is null then
    accrued := 0; spent := 0; available := 0;
    cap := v_cap; monthly_accrual := v_monthly;
    return next;
    return;
  end if;

  v_months := greatest(
    0,
    (extract(year  from age(now(), v_start)) * 12
   + extract(month from age(now(), v_start)))::int
  );

  -- Approved claims summed per accrual period. Period k covers the k-th
  -- completed month of employment; index k maps to array slot k + 1.
  v_spend := array_fill(0, array[v_months + 1]);

  for v_period, v_amount in
    select
      least(
        v_months,
        greatest(
          0,
          (extract(year  from age(mc.expense_date::timestamptz, v_start)) * 12
         + extract(month from age(mc.expense_date::timestamptz, v_start)))::int
        )
      ),
      sum(mc.amount)::int
      from public.medical_claims mc
     where mc.employee_id = p_employee
       and mc.status = 'approved'
     group by 1
  loop
    v_spend[v_period + 1] := v_spend[v_period + 1] + v_amount;
    v_spent := v_spent + v_amount;
  end loop;

  -- Walk the balance forward. Period 0 is the partial month before the first
  -- accrual falls due, so it credits nothing but can still be spent against.
  for v_period in 0 .. v_months loop
    if v_period > 0 then
      v_credit   := greatest(0, least(v_monthly, v_cap - v_balance));
      v_balance  := v_balance + v_credit;
      v_credited := v_credited + v_credit;
    end if;
    v_balance := v_balance - v_spend[v_period + 1];
  end loop;

  -- The running balance may go negative if history contains a claim approved
  -- beyond what was available at the time; carry that debt internally so it is
  -- re-earned, but never report a negative entitlement.
  accrued         := v_credited;
  spent           := v_spent;
  available       := greatest(0, v_balance);
  cap             := v_cap;
  monthly_accrual := v_monthly;
  return next;
end
$function$;

comment on function public.medical_balance(uuid) is
  'Replenishing medical allowance. Credits `monthly` per completed month of '
  'employment, clamped so the balance never exceeds `cap`; approved claims '
  'reduce it by expense_date and free up room for future accrual. Returns the '
  'lifetime credited total, lifetime approved spend, and the currently '
  'available balance.';
