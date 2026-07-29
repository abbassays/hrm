-- Employee removal must start at auth.users so a deleted person cannot retain a
-- login while their HR row is gone. The FK makes the public employee row follow
-- atomically, and its dependent FKs cascade through the employee-owned data.
--
-- This production database already has an auth-users FK from an older manual
-- migration; the conditional keeps this migration safe for both existing and
-- fresh environments.
do $$
declare
  v_constraint_name text;
  v_delete_action "char";
begin
  select conname, confdeltype
    into v_constraint_name, v_delete_action
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f';

  if v_constraint_name is null then
    alter table public.employees
      add constraint employees_auth_user_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  elsif v_delete_action <> 'c' then
    execute format(
      'alter table public.employees drop constraint %I',
      v_constraint_name
    );
    alter table public.employees
      add constraint employees_auth_user_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

-- A payslip is employee-owned just like leave, medical, overtime, contracts,
-- acknowledgements, notifications, and the onboarding detail tables. It was
-- the only owned table that could block the employee cascade.
alter table public.payslips
  drop constraint if exists payslips_employee_id_fkey;

alter table public.payslips
  add constraint payslips_employee_id_fkey
  foreign key (employee_id) references public.employees(id) on delete cascade;

-- `employee_documents` was introduced outside the checked-in migration history
-- but exists in deployed databases. Keep its direct employee relation explicit
-- when present, without making fresh local setups depend on that legacy table.
do $$
declare
  v_constraint_name text;
  v_delete_action "char";
begin
  if to_regclass('public.employee_documents') is not null then
    select conname, confdeltype
      into v_constraint_name, v_delete_action
      from pg_constraint
      where conrelid = 'public.employee_documents'::regclass
        and confrelid = 'public.employees'::regclass
        and contype = 'f'
        and conkey = array[
          (select attnum
           from pg_attribute
           where attrelid = 'public.employee_documents'::regclass
             and attname = 'employee_id'
             and not attisdropped)
        ];

    if v_constraint_name is null then
      alter table public.employee_documents
        add constraint employee_documents_employee_id_fkey
        foreign key (employee_id) references public.employees(id) on delete cascade;
    elsif v_delete_action <> 'c' then
      execute format(
        'alter table public.employee_documents drop constraint %I',
        v_constraint_name
      );
      alter table public.employee_documents
        add constraint employee_documents_employee_id_fkey
        foreign key (employee_id) references public.employees(id) on delete cascade;
    end if;
  end if;
end;
$$;
