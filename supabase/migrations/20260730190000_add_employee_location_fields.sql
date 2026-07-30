alter table public.employees
  add column if not exists city text,
  add column if not exists postal_code text;
