-- Add the employment types the app has always offered.
--
-- `employmentConfigSchema` lets an admin pick full_time, part_time, contract or
-- internship, but the enum only ever had the first two. Choosing either of the
-- others failed at runtime on the upsert.
--
-- It typechecked because the committed src/types/supabase.ts was stale and
-- claimed all four values existed; regenerating the types against production
-- removed the cover and exposed it.
--
-- Widening the enum rather than narrowing the form: the extra options were
-- added deliberately and contract/internship are real employment arrangements
-- here. Nothing existing changes — this only makes previously-rejected values
-- storable.

alter type public.employment_type add value if not exists 'contract';
alter type public.employment_type add value if not exists 'internship';
