begin;
alter table public.creator_search_quality add column enabled boolean not null default true;
create table public.creator_search_defaults (
 creator_id uuid primary key references public.creator_profiles(id),
 version integer not null default 1,
 settings jsonb,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create table public.creator_search_chat (
 id uuid primary key,
 actor uuid not null references auth.users(id),
 creator_id uuid not null references public.creator_profiles(id),
 profile_id uuid not null references public.content_profiles(id),
 scope text not null check(scope in ('profile','creator')),
 message text not null,
 base_version integer not null,
 defaults_version integer not null,
 before_settings jsonb not null,
 before_enabled boolean not null,
 proposal jsonb,
 after_settings jsonb,
 status text not null default 'pending' check(status in ('pending','ready','error','applied','undone')),
 applied_version integer,
 created_at timestamptz not null default now()
);
alter table public.creator_search_defaults enable row level security;
alter table public.creator_search_chat enable row level security;
revoke all on public.creator_search_defaults,public.creator_search_chat from anon,authenticated;
grant all on public.creator_search_defaults,public.creator_search_chat to service_role;

-- Manual saves/rollbacks reactivate a profile override after an undo.
create function public.creator_search_quality_enable() returns trigger language plpgsql as $$
begin
 if new.seek_situations is distinct from old.seek_situations or new.avoid_topics is distinct from old.avoid_topics
 or new.screening_criteria is distinct from old.screening_criteria or new.platforms is distinct from old.platforms
 or new.good_examples is distinct from old.good_examples or new.bad_examples is distinct from old.bad_examples
 or new.version is distinct from old.version then new.enabled := true; end if;
 return new;
end $$;
create trigger creator_search_quality_enable before update on public.creator_search_quality for each row execute function public.creator_search_quality_enable();

create function public.creator_apply_search_chat(p_id uuid,p_actor uuid,p_undo boolean default false)
returns integer language plpgsql security definer set search_path=public as $$
declare r public.creator_search_chat; v_version integer; v_defaults integer; v_settings jsonb;
begin
 if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->'creator_cost_admin'='true'::jsonb) then raise exception 'FORBIDDEN'; end if;
 select * into r from creator_search_chat where id=p_id and actor=p_actor for update;
 if r.id is null then raise exception 'PROPOSAL_NOT_FOUND'; end if;
 if (not p_undo and r.status='applied') or (p_undo and r.status='undone') then return r.applied_version; end if;
 if (not p_undo and (r.status<>'ready' or r.after_settings is null)) or (p_undo and r.status<>'applied') then raise exception 'NOT_READY'; end if;
 perform 1 from creator_profiles where id=r.creator_id for update;
 if not exists(select 1 from content_profiles where id=r.profile_id and creator_profile_id=r.creator_id) then raise exception 'PROFILE_NOT_FOUND'; end if;
 select version into v_defaults from creator_search_defaults where creator_id=r.creator_id;
 v_defaults:=coalesce(v_defaults,0);
 v_settings:=case when p_undo then r.before_settings else r.after_settings end;
 if r.scope='creator' then
   if v_defaults<>(case when p_undo then r.applied_version else r.base_version end) then raise exception 'VERSION_CONFLICT'; end if;
   v_version:=v_defaults+1;
   insert into creator_search_defaults(creator_id,version,settings,updated_by)
   values(r.creator_id,v_version,case when p_undo and not r.before_enabled then null else v_settings end,p_actor)
   on conflict(creator_id) do update set version=excluded.version,settings=excluded.settings,updated_by=p_actor,updated_at=clock_timestamp();
 else
   if not p_undo and v_defaults<>r.defaults_version then raise exception 'VERSION_CONFLICT'; end if;
   select version into v_version from creator_search_quality where content_profile_id=r.profile_id;
   if coalesce(v_version,0)<>(case when p_undo then r.applied_version else r.base_version end) then raise exception 'VERSION_CONFLICT'; end if;
   v_version:=creator_save_search_quality(r.profile_id,coalesce(v_version,0),v_settings,p_actor);
   if p_undo and not r.before_enabled then update creator_search_quality set enabled=false where content_profile_id=r.profile_id; end if;
 end if;
 update creator_search_chat set status=case when p_undo then 'undone' else 'applied' end,applied_version=v_version where id=p_id;
 return v_version;
end $$;
revoke all on function public.creator_apply_search_chat(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.creator_apply_search_chat(uuid,uuid,boolean) to service_role;
commit;
