begin;
-- Recover completed screening rounds from the checkpoint, not the Apify run ID
-- that replaced provider_response_id when the next discovery round started.
update public.creator_research_usage u set
 provider_cost_usd=(j.provider_metadata->>'accumulatedCost')::numeric,
 pricing_version='saved-provider-round-total-2026-10-14',
 request_metadata=coalesce(u.request_metadata,'{}')||jsonb_build_object('cost_source','Provider-reported screening costs retained in completed round checkpoints')
from public.creator_research_jobs j
where j.id=u.job_id and u.id in ('648a0351-0bc0-4042-8c58-4047a6bc3911','07d40294-92a5-42d0-be43-2b82ce127c88')
 and u.provider_cost_usd is null and j.provider_metadata->>'stage'='multi_discovery'
 and jsonb_typeof(j.provider_metadata->'accumulatedCost')='number'
 and (j.provider_metadata->>'accumulatedCost')::numeric>0
 and not exists(select 1 from public.creator_research_usage other where other.job_id=u.job_id and other.provider_cost_usd is not null);
-- This configuration check throws before fetch; no provider request was sent.
update public.creator_research_usage set provider_cost_usd=0,
 pricing_version='pre-submission-rejection-2026-10-14',
 request_metadata=request_metadata||jsonb_build_object('cost_source','NOT_CONFIGURED throws before provider fetch; no request submitted')
where id='a9f21d63-bfc8-4c70-9d10-2176065a0104' and provider_cost_usd is null
 and provider_response_id is null and request_metadata->>'code'='NOT_CONFIGURED';
-- Provider rejected creation for insufficient balance; no video was created.
update public.creator_presenter_tests set snapshot=jsonb_set(snapshot,'{cost_reconciliation}',
 jsonb_build_object('reported_usd',0,'source','Provider rejected submission: insufficient API credits; no video ID','checked_at',now()))
where id='de342b96-647d-488d-a1a4-f69ed8fde95c' and status='failed' and provider_video_id is null
 and message='HeyGen reports insufficient API credits.';

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
commit;
