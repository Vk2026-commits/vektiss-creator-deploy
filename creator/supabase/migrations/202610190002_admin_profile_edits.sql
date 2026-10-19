begin;
create table public.creator_admin_profile_edits (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('creator','content')),
  profile_id uuid not null,
  user_id uuid not null references auth.users(id),
  changed_by uuid not null references auth.users(id),
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.creator_admin_profile_edits enable row level security;
revoke all on public.creator_admin_profile_edits from anon, authenticated;
grant all on public.creator_admin_profile_edits to service_role;

create function public.creator_admin_save_profile(
  p_scope text, p_profile_id uuid, p_expected_updated_at timestamptz, p_input jsonb, p_actor uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_before jsonb; v_after jsonb;
begin
  if not exists (select 1 from auth.users where id=p_actor and raw_app_meta_data->'creator_cost_admin'='true'::jsonb)
    then raise exception 'FORBIDDEN'; end if;
  if p_scope='creator' then
    select to_jsonb(c) into v_before from public.creator_profiles c where id=p_profile_id for update;
  elsif p_scope='content' then
    select to_jsonb(c) into v_before from public.content_profiles c where id=p_profile_id for update;
  else raise exception 'INVALID_SCOPE'; end if;
  if v_before is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if (v_before->>'updated_at')::timestamptz is distinct from p_expected_updated_at then raise exception 'VERSION_CONFLICT'; end if;
  if p_scope='creator' then
    update public.creator_profiles c set
      display_name=p_input->>'display_name', bio=p_input->>'bio',
      -- Voice setup/approvals and unknown future fields are not editorial settings.
      context=coalesce(c.context,'{}'::jsonb) || ((p_input->'context') - 'delivery' - 'delivery_setup'),
      updated_at=clock_timestamp()
      where id=p_profile_id returning to_jsonb(c) into v_after;
  else
    update public.content_profiles c set
      name=p_input->>'name', primary_audience=p_input->>'primary_audience',
      strategy=coalesce(c.strategy,'{}'::jsonb) || (p_input->'strategy'),
      cta_default=case when p_input ? 'cta_default' then nullif(p_input->'cta_default','null'::jsonb) else c.cta_default end,
      cta_campaign=case when p_input ? 'cta_campaign' then nullif(p_input->'cta_campaign','null'::jsonb) else c.cta_campaign end,
      updated_at=clock_timestamp()
      where id=p_profile_id returning to_jsonb(c) into v_after;
  end if;
  insert into public.creator_admin_profile_edits(scope,profile_id,user_id,changed_by,before_snapshot,after_snapshot)
    values(p_scope,p_profile_id,(v_before->>'user_id')::uuid,p_actor,v_before,v_after);
  return v_after;
end $$;
revoke all on function public.creator_admin_save_profile(text,uuid,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.creator_admin_save_profile(text,uuid,timestamptz,jsonb,uuid) to service_role;
commit;
