begin;
alter table public.creator_ai_generations add column if not exists provider_requests jsonb not null default '[]';
create or replace function public.creator_usage_dashboard_v3(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.creator_usage_dashboard_v2(p_from,p_to);
 select jsonb_set(result,'{events}',coalesce(jsonb_agg(e.value || case when r.id is not null then jsonb_build_object(
 'project_title',s.title,'fixture',coalesce(r.snapshot->>'fixture','')<>'',
 'cost_source',coalesce(r.snapshot->'cost_reconciliation'->>'source','Saved render settings'),
 'cost_reason',r.snapshot->'cost_reconciliation'->>'reason',
 'engine',coalesce(r.snapshot->'cost_reconciliation'->>'engine',e.value->>'engine'),
 'avatar_type',coalesce(r.snapshot->'cost_reconciliation'->>'avatar_type',e.value->>'avatar_type')
 ) else '{}'::jsonb end),'[]'::jsonb)) into result
 from jsonb_array_elements(result->'events') e
 left join public.creator_presenter_tests r on 'render:'||r.id=e.value->>'id'
 left join public.creator_scripts s on s.id=r.script_id and s.user_id=r.user_id;
 return result;
end $$;
revoke all on function public.creator_usage_dashboard_v3(timestamptz,timestamptz) from public,anon;
grant execute on function public.creator_usage_dashboard_v3(timestamptz,timestamptz) to authenticated;
create or replace function public.creator_save_cost_evidence(p_id uuid,p_evidence jsonb) returns void
language sql security definer set search_path='' as $$
 update public.creator_presenter_tests set snapshot=jsonb_set(coalesce(snapshot,'{}'),'{cost_reconciliation}',p_evidence,true) where id=p_id;
$$;
revoke all on function public.creator_save_cost_evidence(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.creator_save_cost_evidence(uuid,jsonb) to service_role;
commit;
