begin;
create table public.creator_search_delivery_flags(user_id uuid primary key references auth.users(id) on delete cascade,enabled boolean not null default false);
alter table public.creator_search_delivery_flags enable row level security;
revoke all on public.creator_search_delivery_flags from anon,authenticated;
grant all on public.creator_search_delivery_flags to service_role;
alter table public.creator_research_jobs add column incremental_delivery boolean not null default false;
alter table public.creator_research_jobs add column interruption_reason text;
alter table public.creator_research_jobs add column first_result_at timestamptz;
-- Legacy jobs continue using terminal settlement; incremental jobs settle each batch.
create or replace function public.creator_research_terminal_guard() returns trigger language plpgsql set search_path='' as $$
declare kept integer;
begin
 if OLD.status in ('ready','failed','cancelled') then return OLD; end if;
 if NEW.status in ('ready','failed','cancelled') and NEW.reserved_count=0 then
  select count(*) into kept from public.creator_research_opportunities where job_id=OLD.id;
  update public.creator_research_entitlements set reserved_count=greatest(0,reserved_count-OLD.reserved_count),
   delivered_count=delivered_count+case when OLD.incremental_delivery then greatest(0,kept-OLD.delivered_count) else kept end,updated_at=now() where user_id=OLD.user_id;
  NEW.reserved_count:=0; NEW.delivered_count:=kept;
 end if;
 if NEW.incremental_delivery and NEW.status='ready' and NEW.delivered_count<NEW.requested_count then
  NEW.status:='failed'; NEW.interruption_reason:=coalesce(NEW.interruption_reason,'search_incomplete');
 end if;
 return NEW;
end $$;
create or replace function public.creator_search_deliver(p_job_id uuid,p_user_id uuid,p_rows jsonb)
returns public.creator_research_jobs language plpgsql security definer set search_path='' as $$
declare j public.creator_research_jobs; item jsonb; s jsonb; oid uuid; sid uuid; added int:=0; ord int;
begin
 -- Account lock serializes deduplication and charging across concurrent jobs.
 select * into j from public.creator_research_jobs where id=p_job_id and user_id=p_user_id for update;
 if not found then raise exception 'JOB'; end if;
 perform 1 from public.creator_research_entitlements where user_id=p_user_id for update;
 if not j.incremental_delivery then raise exception 'FEATURE_DISABLED'; end if;
 if j.status in ('ready','failed','cancelled') then return j; end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  exit when j.delivered_count+added>=j.requested_count;
  if exists(select 1 from public.creator_research_opportunities o where o.user_id=p_user_id and
    (o.normalized_title=item->>'normalized_title' or exists(select 1 from jsonb_array_elements(o.source_snapshot) a,jsonb_array_elements(item->'source_snapshot') b where a->>'url'=b->>'url'))) then continue; end if;
  oid:=gen_random_uuid();
  insert into public.creator_research_opportunities(id,job_id,user_id,content_profile_id,normalized_title,title,factual_summary,why_audience_cares,creator_connection,recommended_angle,suggested_hook,category,published_at,timeliness_score,relevance_score,rank_score,uncertainty,evidence_state,source_snapshot)
  values(oid,j.id,p_user_id,j.content_profile_id,item->>'normalized_title',item->>'title',item->>'factual_summary',item->>'why_audience_cares',item->>'creator_connection',item->>'recommended_angle',item->>'suggested_hook',item->>'category',(item->>'published_at')::timestamptz,(item->>'timeliness_score')::numeric,(item->>'relevance_score')::numeric,(item->>'rank_score')::numeric,item->>'uncertainty',item->>'evidence_state',item->'source_snapshot');
  ord:=0;
  for s in select value from jsonb_array_elements(item->'source_snapshot') loop
   ord:=ord+1;
   insert into public.creator_research_sources(id,user_id,canonical_url,title,snippet,source_type,published_at,provider_source_id)
   values(gen_random_uuid(),p_user_id,s->>'url',s->>'title',s->>'snippet',s->>'sourceType',(s->>'publishedAt')::timestamptz,(s->>'providerSourceId')::integer)
   on conflict(user_id,canonical_url) do update set retrieved_at=now() returning id into sid;
   insert into public.creator_research_opportunity_sources(opportunity_id,source_id,source_order) values(oid,sid,ord) on conflict do nothing;
  end loop;
  insert into public.creator_research_feedback(id,opportunity_id,user_id,action,metadata) values(gen_random_uuid(),oid,p_user_id,'shown',jsonb_build_object('jobId',j.id));
  added:=added+1;
 end loop;
 update public.creator_research_entitlements set reserved_count=greatest(0,reserved_count-added),delivered_count=delivered_count+added,updated_at=now() where user_id=p_user_id;
 update public.creator_research_jobs set delivered_count=delivered_count+added,reserved_count=greatest(0,reserved_count-added),first_result_at=case when added>0 then coalesce(first_result_at,now()) else first_result_at end,updated_at=now() where id=j.id returning * into j;
 return j;
end $$;
revoke all on function public.creator_search_deliver(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.creator_search_deliver(uuid,uuid,jsonb) to service_role;
alter table public.creator_research_jobs add column resume_of uuid references public.creator_research_jobs(id);
create unique index creator_search_resume_once on public.creator_research_jobs(resume_of) where resume_of is not null;
create table public.creator_search_cache(user_id uuid not null references auth.users(id) on delete cascade,cache_key text not null,payload jsonb not null,expires_at timestamptz not null,primary key(user_id,cache_key));
alter table public.creator_search_cache enable row level security;
revoke all on public.creator_search_cache from anon,authenticated;
grant all on public.creator_search_cache to service_role;
create index creator_search_cache_expiry on public.creator_search_cache(expires_at);
commit;
