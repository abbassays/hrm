-- Allow more than one policy per category.
--
-- `policies` carried UNIQUE (category) against a four-value enum
-- (general | leave | medical | overtime), which capped the entire product at
-- four policy documents forever. That surfaced when importing the real policy
-- library: "Remote Work SOPs" is a `general` policy and had nowhere to go
-- because Code of Conduct already occupied the category.
--
-- Category is a grouping label, not an identity. `slug` is already UNIQUE and
-- is the real identifier -- it is what the app routes on -- so dropping this
-- constraint loses no integrity. Categories become what they read as: a filter.
--
-- The index that backed the constraint is replaced with a plain, non-unique one
-- so category filtering keeps its index.

alter table public.policies
  drop constraint if exists policies_category_key;

create index if not exists policies_category_idx
  on public.policies (category);

comment on column public.policies.category is
  'Grouping label for filtering. NOT unique — a category may hold several '
  'policies. `slug` is the identifier.';
