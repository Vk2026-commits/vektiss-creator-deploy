begin;
create or replace function public.creator_usage_dashboard_v2(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.creator_usage_dashboard(p_from,p_to);
 select jsonb_set(result,'{events}',coalesce(jsonb_agg(e.value || case when r.id is not null then jsonb_build_object(
 'avatar_type',r.snapshot->'cost_estimate'->>'avatar_type',
 'seconds',coalesce((r.snapshot->>'provider_duration_seconds')::numeric,(e.value->>'seconds')::numeric),
 'duration_basis',case when r.snapshot->>'provider_duration_seconds' is not null then 'HeyGen video length' else 'Estimated speech length' end
 ) else '{}'::jsonb end),'[]'::jsonb)) into result
 from jsonb_array_elements(result->'events') e
 left join public.creator_presenter_tests r on 'render:'||r.id=e.value->>'id';
 return result;
end $$;
revoke all on function public.creator_usage_dashboard_v2(timestamptz,timestamptz) from public,anon;
grant execute on function public.creator_usage_dashboard_v2(timestamptz,timestamptz) to authenticated;
commit;
