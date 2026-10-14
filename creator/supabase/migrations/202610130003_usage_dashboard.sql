begin;
create table public.creator_provider_costs (
 provider text not null, external_id text not null, user_id uuid not null references auth.users(id),
 job_id uuid references public.creator_research_jobs(id), operation text not null, status text not null,
 cost_usd numeric check(cost_usd>=0), created_at timestamptz not null default now(),
 primary key(provider,external_id)
);
alter table public.creator_provider_costs enable row level security;
revoke all on public.creator_provider_costs from anon,authenticated;
grant all on public.creator_provider_costs to service_role;
create table public.creator_shared_costs (
 id uuid primary key, provider text not null check(length(provider) between 1 and 80),
 amount_usd numeric not null check(amount_usd>=0 and amount_usd<=1000000),
 period_start date not null, period_end date not null check(period_end>=period_start),
 basis text not null check(basis in ('invoice','estimate')), note text not null check(length(note)<=1000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
alter table public.creator_shared_costs enable row level security;
revoke all on public.creator_shared_costs from anon,authenticated;
grant select,insert on public.creator_shared_costs to authenticated;
grant all on public.creator_shared_costs to service_role;
create policy shared_cost_admin_read on public.creator_shared_costs for select to authenticated using(public.creator_is_cost_admin());
create policy shared_cost_admin_insert on public.creator_shared_costs for insert to authenticated with check(public.creator_is_cost_admin() and created_by=auth.uid());

create or replace function public.creator_usage_dashboard(p_from timestamptz,p_to timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.creator_is_cost_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'DATE_RANGE'; end if;
 with events as (
 select 'ai:'||a.id as id,a.user_id,a.project_id,'OpenAI'::text as provider,a.action as operation,a.model,
 null::text as avatar,null::text as engine,null::text as voice,a.status,a.created_at as at,
 null::numeric as reported,a.estimated_cost_usd::numeric as estimate,0::numeric as seconds,0::bigint as bytes
 from public.creator_ai_generations a where a.created_at>=p_from and a.created_at<p_to
 union all
 select 'render:'||r.id,r.user_id,r.script_id,'HeyGen',coalesce(r.snapshot->>'scope','test'),r.snapshot->>'avatar_engine',
 coalesce(r.snapshot->>'avatar_name',r.snapshot->>'avatar_id','Unrecorded avatar'),r.snapshot->>'avatar_engine',r.snapshot->>'voice_engine',r.status,r.created_at,
 e.quantity*e.unit_rate_usd,
 case when e.id is null and r.status not in ('failed','uncertain','pending') then (r.snapshot->'cost_estimate'->>'estimated_cost_usd')::numeric end,
 coalesce((r.snapshot->'cost_estimate'->>'estimated_seconds')::numeric,0),0
 from public.creator_presenter_tests r left join public.creator_cost_entries e on e.render_id=r.id and e.kind='heygen'
 where r.created_at>=p_from and r.created_at<p_to
 union all
 select 'research:'||u.id,u.user_id,null,'Research AI',coalesce(u.model,'Unrecorded model'),u.model,null,null,null,u.status,u.created_at,u.provider_cost_usd,null,coalesce(u.elapsed_ms,0)/1000.0,0
 from public.creator_research_usage u where u.operation<>'deep_research_start' and u.created_at>=p_from and u.created_at<p_to
 union all
 select 'provider:'||p.provider||':'||p.external_id,p.user_id,null,p.provider,p.operation,null,null,null,null,p.status,p.created_at,p.cost_usd,null,0,0
 from public.creator_provider_costs p where p.created_at>=p_from and p.created_at<p_to
 union all
 select 'processing:'||j.id,j.user_id,j.project_id,'Bunny processing',j.operation,null,null,null,null,j.status,j.started_at,null,null,coalesce(j.elapsed_ms,0)/1000.0,coalesce(j.upload_bytes,0)
 from public.creator_processing_usage j where j.started_at>=p_from and j.started_at<p_to
 union all
 select 'preview:'||v.id,v.user_id,null,'HeyGen','voice preview',v.settings->>'voice_engine',null,null,v.settings->>'voice_engine',v.status,v.created_at,null,null,0,0
 from public.creator_voice_previews v where v.created_at>=p_from and v.created_at<p_to
 union all
 select 'support:'||e.id,e.user_id,e.project_id,'Support','manual time',null,null,null,null,'recorded',e.created_at,e.quantity*e.unit_rate_usd,null,e.quantity*60,0
 from public.creator_cost_entries e where e.kind='support' and e.created_at>=p_from and e.created_at<p_to
 ), bounded as (select * from events order by at desc,id limit 50000)
 select jsonb_build_object(
 'asOf',now(),'truncated',(select count(*)>50000 from events),
 'creators',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name)) from public.creator_profiles),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(b)) from bounded b),'[]'),
 'shared',coalesce((select jsonb_agg(to_jsonb(s)) from public.creator_shared_costs s where s.period_start<p_to::date and s.period_end>=p_from::date),'[]'),
 'researchJobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'user_id',j.user_id,'status',j.status,'delivered',j.delivered_count)) from public.creator_research_jobs j where j.created_at>=p_from and j.created_at<p_to),'[]')
 ) into result;
 return result;
end; $$;
revoke all on function public.creator_usage_dashboard(timestamptz,timestamptz) from public,anon;
grant execute on function public.creator_usage_dashboard(timestamptz,timestamptz) to authenticated;
commit;
