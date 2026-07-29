-- Each policy category represents one canonical employee document. The server
-- derives its stable rule-linking slug so titles can change without exposing a
-- technical identifier to administrators.

alter table policies
  add constraint policies_category_key unique (category);

drop function if exists create_policy(text, text, policy_category, text);

create function create_policy(
  p_title text,
  p_category policy_category,
  p_body_html text
)
returns policies
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function create_policy(text, policy_category, text) from public, anon;
grant execute on function create_policy(text, policy_category, text) to authenticated;
