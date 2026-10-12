begin;

-- Keep Creator media access aligned with the selected Discover pilot. The function
-- exposes only the signed-in user's yes/no result; entitlement rows remain private.
create or replace function public.creator_hosted_pilot_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.feature_enabled and e.enabled
    from public.creator_research_entitlements e
    cross join public.creator_research_config c
    where c.id = true
      and e.user_id = (select auth.uid())
  ), false);
$$;

revoke all on function public.creator_hosted_pilot_access() from public;
grant execute on function public.creator_hosted_pilot_access() to authenticated;

commit;
