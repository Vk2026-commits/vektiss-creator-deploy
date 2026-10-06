begin;

-- These tables are deliberately Edge Function/service-role only. Explicit deny policies
-- keep that design visible to the RLS linter without granting browser access.
create policy creator_research_config_server_only on public.creator_research_config
  as restrictive for all to authenticated using (false) with check (false);
create policy creator_research_entitlements_server_only on public.creator_research_entitlements
  as restrictive for all to authenticated using (false) with check (false);

commit;
