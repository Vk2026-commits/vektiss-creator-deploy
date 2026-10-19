begin;

create table public.creator_search_quality (
  content_profile_id uuid primary key,
  user_id uuid not null,
  version integer not null default 1 check (version > 0),
  seek_situations text not null default '' check (length(seek_situations) <= 5000),
  avoid_topics text not null default '' check (length(avoid_topics) <= 5000),
  screening_criteria text not null default '' check (length(screening_criteria) <= 5000),
  platforms jsonb not null default '["TikTok","Instagram","YouTube"]'::jsonb check (jsonb_typeof(platforms) = 'array'),
  good_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(good_examples) = 'array'),
  bad_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(bad_examples) = 'array'),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key (content_profile_id, user_id) references public.content_profiles(id, user_id) on delete cascade
);
create table public.creator_search_quality_history (
  id uuid primary key,
  content_profile_id uuid not null references public.creator_search_quality(content_profile_id) on delete cascade,
  version integer not null,
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  changed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (content_profile_id, version)
);
create index creator_search_quality_history_recent on public.creator_search_quality_history(content_profile_id, version desc);
alter table public.creator_search_quality enable row level security;
alter table public.creator_search_quality_history enable row level security;
revoke all on public.creator_search_quality, public.creator_search_quality_history from anon, authenticated;
grant all on public.creator_search_quality, public.creator_search_quality_history to service_role;

create function public.creator_save_search_quality(
  p_profile_id uuid, p_expected_version integer, p_settings jsonb, p_actor uuid
) returns integer language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_version integer;
begin
  select user_id into v_owner from public.content_profiles where id = p_profile_id;
  if v_owner is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if p_expected_version = 0 then
    insert into public.creator_search_quality
      (content_profile_id,user_id,version,seek_situations,avoid_topics,screening_criteria,platforms,good_examples,bad_examples,updated_by)
    values (p_profile_id,v_owner,1,p_settings->>'seekSituations',p_settings->>'avoidTopics',p_settings->>'screeningCriteria',
      p_settings->'platforms',p_settings->'goodExamples',p_settings->'badExamples',p_actor)
    on conflict do nothing returning version into v_version;
  else
    update public.creator_search_quality set version=version+1,
      seek_situations=p_settings->>'seekSituations',avoid_topics=p_settings->>'avoidTopics',
      screening_criteria=p_settings->>'screeningCriteria',platforms=p_settings->'platforms',
      good_examples=p_settings->'goodExamples',bad_examples=p_settings->'badExamples',
      updated_by=p_actor,updated_at=now()
    where content_profile_id=p_profile_id and version=p_expected_version returning version into v_version;
  end if;
  if v_version is null then raise exception 'VERSION_CONFLICT'; end if;
  insert into public.creator_search_quality_history(id,content_profile_id,version,settings,changed_by)
  values (gen_random_uuid(),p_profile_id,v_version,p_settings,p_actor);
  return v_version;
end $$;
revoke all on function public.creator_save_search_quality(uuid,integer,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.creator_save_search_quality(uuid,integer,jsonb,uuid) to service_role;

alter table public.creator_research_feedback drop constraint if exists creator_research_feedback_reason_check;
alter table public.creator_research_feedback add constraint creator_research_feedback_reason_check
  check (reason is null or reason in ('not_relevant','already_talked_about_this','dont_like_this_topic','too_old','not_my_audience','wrong_angle','other','off_topic','staged','duplicate','unavailable','poor_quality'));

create function public.creator_admin_reject_research(p_profile_id uuid,p_opportunity_id uuid,p_reason text,p_actor uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_idea record; v_last_reason text;
begin
  if p_reason not in ('off_topic','staged','duplicate','unavailable','poor_quality','not_relevant','wrong_angle') then raise exception 'INVALID_REASON'; end if;
  select id,user_id,status into v_idea from public.creator_research_opportunities
    where id=p_opportunity_id and content_profile_id=p_profile_id for update;
  if v_idea.id is null then raise exception 'OPPORTUNITY_NOT_FOUND'; end if;
  if v_idea.status in ('selected','turned_into_content') then raise exception 'ALREADY_USED'; end if;
  select reason into v_last_reason from public.creator_research_feedback
    where opportunity_id=p_opportunity_id and action='rejected' order by created_at desc,id desc limit 1;
  if v_idea.status='rejected' and v_last_reason=p_reason then return false; end if;
  update public.creator_research_opportunities set status='rejected',updated_at=now() where id=p_opportunity_id;
  insert into public.creator_research_feedback(id,opportunity_id,user_id,action,reason,metadata)
    values(gen_random_uuid(),p_opportunity_id,v_idea.user_id,'rejected',p_reason,jsonb_build_object('admin_actor',p_actor));
  return true;
end $$;
revoke all on function public.creator_admin_reject_research(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.creator_admin_reject_research(uuid,uuid,text,uuid) to service_role;

commit;
