-- Identity-document metadata was originally introduced outside the checked-in
-- migration history. Keep one document of each type per employee.
create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  doc_type text not null check (doc_type in ('cnic_front', 'cnic_back', 'photo')),
  storage_path text not null,
  file_name text,
  uploaded_at timestamptz not null default now(),
  unique (employee_id, doc_type)
);

alter table public.employee_documents enable row level security;

create policy employee_documents_own
on public.employee_documents
for all
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

create policy employee_documents_admin
on public.employee_documents
for all
using (public.is_admin())
with check (public.is_admin());

-- The singleton drives feature-toggle visibility across the application.
create table public.system_config (
  id boolean primary key default true check (id),
  reimbursements_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.system_config (id, reimbursements_enabled)
values (true, false);

create trigger trg_system_config_updated
before update on public.system_config
for each row execute function public.set_updated_at();

alter table public.system_config enable row level security;

create policy sysconfig_read
on public.system_config
for select
to authenticated
using (true);

create policy sysconfig_write
on public.system_config
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Identity documents are private. The first storage-path segment is always
-- the employee UUID, so a user can touch only their own objects; admins retain
-- access for verification and support.
create policy idocs_own
on storage.objects
for all
using (
  bucket_id = 'identity-docs'
  and (storage.foldername(name))[1] = (auth.uid())::text
)
with check (
  bucket_id = 'identity-docs'
  and (storage.foldername(name))[1] = (auth.uid())::text
);

create policy idocs_admin
on storage.objects
for all
using (bucket_id = 'identity-docs' and public.is_admin())
with check (bucket_id = 'identity-docs' and public.is_admin());
