begin;
-- Four completed previews match the four charged voice activities, by date/time
-- and chronological order. Unlike video rows, this ledger exposes no request ID.
-- Retain that limitation and the displayed-cent precision in the evidence.
with ledger(id,engine,usd) as (values
 ('14eb3e46-129f-4894-bf65-c070539a2729'::uuid,'elevenlabs',0.02),
 ('1e6df37b-d00e-40ec-a793-d01a89139d5a'::uuid,'elevenlabs',0.02),
 ('334562e8-4586-402a-89a3-4bbaf2bd50fb'::uuid,'starfish',0.03),
 ('104ab2a4-13bb-43a2-b360-4b0e22379a8a'::uuid,'starfish',0.02)
)
update public.creator_voice_previews v set result=jsonb_set(result,'{cost_reconciliation}',jsonb_build_object(
 'reported_usd',l.usd,'source','HeyGen API Activity ledger, read 2026-10-14; matched by timestamp and order across four voice activities; displayed USD rounded to cents; request ID unavailable',
 'checked_at','2026-10-14')) from ledger l
where v.id=l.id and v.status='completed' and v.result->>'engine'=l.engine;

create or replace function public.creator_usage_dashboard_v3(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare dashboard_result jsonb;
begin
 dashboard_result:=public.creator_usage_dashboard_v2(p_from,p_to);
 select jsonb_set(dashboard_result,'{events}',coalesce(jsonb_agg(e.value || case when r.id is not null then jsonb_build_object(
 'project_title',s.title,'fixture',coalesce(r.snapshot->>'fixture','')<>'',
 'reported',coalesce((e.value->>'reported')::numeric,(r.snapshot->'cost_reconciliation'->>'reported_usd')::numeric),
 'cost_source',coalesce(r.snapshot->'cost_reconciliation'->>'source','Saved render settings'),
 'cost_reason',r.snapshot->'cost_reconciliation'->>'reason',
 'engine',coalesce(r.snapshot->'cost_reconciliation'->>'engine',e.value->>'engine'),
 'avatar_type',coalesce(r.snapshot->'cost_reconciliation'->>'avatar_type',e.value->>'avatar_type')
 ) when u.id is not null then jsonb_build_object('cost_source',u.request_metadata->>'cost_source')
 when v.id is not null and v.status='completed' and jsonb_typeof(v.result->'cost_reconciliation'->'reported_usd')='number' then jsonb_build_object(
 'reported',(v.result->'cost_reconciliation'->>'reported_usd')::numeric,
 'cost_source',v.result->'cost_reconciliation'->>'source','cost_reason',null)
 when v.id is not null and v.status='completed' and v.result->>'engine'='starfish'
 and jsonb_typeof(v.result->'duration')='number' and (v.result->>'duration')::numeric>0 then jsonb_build_object(
 'estimate',(v.result->>'duration')::numeric*0.12/60,
 'seconds',(v.result->>'duration')::numeric,
 'cost_source','HeyGen Starfish API: $0.12/min × returned audio duration; current published rate, not an invoice',
 'duration_basis','Provider audio duration')
 else '{}'::jsonb end),'[]'::jsonb)) into dashboard_result
 from jsonb_array_elements(dashboard_result->'events') e
 left join public.creator_presenter_tests r on 'render:'||r.id=e.value->>'id'
 left join public.creator_scripts s on s.id=r.script_id and s.user_id=r.user_id
 left join public.creator_research_usage u on 'research:'||u.id=e.value->>'id'
 left join public.creator_voice_previews v on 'preview:'||v.id=e.value->>'id';
 return dashboard_result;
end $$;
revoke all on function public.creator_usage_dashboard_v3(timestamptz,timestamptz) from public,anon;
grant execute on function public.creator_usage_dashboard_v3(timestamptz,timestamptz) to authenticated;

-- Metadata recovery must never erase previously reconciled ledger evidence.
create or replace function public.creator_save_cost_evidence(p_id uuid,p_evidence jsonb) returns void
language sql security definer set search_path='' as $$
 update public.creator_presenter_tests set snapshot=jsonb_set(coalesce(snapshot,'{}'),'{cost_reconciliation}',
 coalesce(snapshot->'cost_reconciliation','{}') || p_evidence ||
 case when jsonb_typeof(snapshot->'cost_reconciliation'->'reported_usd')='number'
 then jsonb_build_object('reported_usd',snapshot->'cost_reconciliation'->'reported_usd',
 'source',snapshot->'cost_reconciliation'->'source','reason',null) else '{}'::jsonb end,true) where id=p_id;
$$;
revoke all on function public.creator_save_cost_evidence(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.creator_save_cost_evidence(uuid,jsonb) to service_role;
commit;
