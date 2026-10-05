begin;
-- Admin membership is server-managed app metadata, never user-editable metadata.
create or replace function public.creator_is_cost_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid()
 and u.raw_app_meta_data->>'creator_cost_admin' = 'true');
$$;
revoke all on function public.creator_is_cost_admin() from public,anon;
grant execute on function public.creator_is_cost_admin() to authenticated,service_role;
-- Restrictive policies combine with existing ownership policies. Cost telemetry
-- collection remains unchanged; consumer accounts cannot read/write manual costs.
create policy cost_admin_read on public.creator_cost_entries as restrictive
for select to authenticated using ((select public.creator_is_cost_admin()));
create policy cost_admin_insert on public.creator_cost_entries as restrictive
for insert to authenticated with check ((select public.creator_is_cost_admin()));
commit;
