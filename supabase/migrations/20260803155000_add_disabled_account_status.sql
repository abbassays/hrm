-- PostgreSQL requires an enum value to be committed before a following
-- migration can reference it in a constraint or data write.
alter type public.account_status add value if not exists 'disabled';
