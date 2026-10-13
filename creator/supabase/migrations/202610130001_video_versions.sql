-- Each row is a version; project_id groups versions without changing legacy IDs.
alter table public.creator_scripts add column if not exists project_id uuid;
alter table public.creator_scripts add column if not exists parent_version_id uuid references public.creator_scripts(id) on delete restrict;
alter table public.creator_scripts add column if not exists version_number integer not null default 1;
alter table public.creator_scripts add column if not exists version_request_id uuid;
alter table public.creator_scripts add column if not exists finalized_at timestamptz;
update public.creator_scripts set project_id=id where project_id is null;
update public.creator_scripts set finalized_at=updated_at where finalized_at is null and brief#>>'{production,render,status}'='ready' and brief#>>'{production,render,export_id}' is not null;
alter table public.creator_scripts alter column project_id set not null;
create unique index if not exists creator_version_number on public.creator_scripts(project_id,version_number);
create unique index if not exists creator_version_request on public.creator_scripts(user_id,version_request_id) where version_request_id is not null;
create unique index if not exists creator_version_open_draft on public.creator_scripts(parent_version_id) where parent_version_id is not null and finalized_at is null;

create or replace function public.creator_guard_video_version() returns trigger language plpgsql set search_path=public as $$
declare parent public.creator_scripts;
begin
 if TG_OP='DELETE' then
  if OLD.finalized_at is not null then raise exception 'Finished versions must be retained'; end if;
  return OLD;
 end if;
 if TG_OP='INSERT' then
  if NEW.parent_version_id is null then NEW.project_id=NEW.id; NEW.version_number=1; NEW.version_request_id=null;
  else
   select * into parent from public.creator_scripts where id=NEW.parent_version_id;
   if parent.id is null or parent.user_id<>NEW.user_id or parent.project_id<>NEW.project_id or parent.finalized_at is null or current_setting('creator.version_create',true) is distinct from 'yes' then raise exception 'Invalid version parent'; end if;
  end if;
  NEW.finalized_at=null;
 else
  if (NEW.project_id,NEW.parent_version_id,NEW.version_number,NEW.version_request_id,NEW.user_id) is distinct from (OLD.project_id,OLD.parent_version_id,OLD.version_number,OLD.version_request_id,OLD.user_id) then raise exception 'Version identity is immutable'; end if;
  if OLD.finalized_at is not null and (to_jsonb(NEW)-'updated_at') is distinct from (to_jsonb(OLD)-'updated_at') then raise exception 'Finished video is read-only. Make another version.'; end if;
  NEW.finalized_at=OLD.finalized_at;
 end if;
 if NEW.brief#>>'{production,render,status}'='ready' and NEW.brief#>>'{production,render,export_id}' is not null then NEW.finalized_at=coalesce(NEW.finalized_at,now()); end if;
 return NEW;
end $$;
drop trigger if exists creator_video_version_guard on public.creator_scripts;
create trigger creator_video_version_guard before insert or update or delete on public.creator_scripts for each row execute function public.creator_guard_video_version();

create or replace function public.create_video_version(source_id uuid,request_key uuid) returns public.creator_scripts
language plpgsql security definer set search_path=public as $$
declare source public.creator_scripts; result public.creator_scripts; next_number integer; copied jsonb;
begin
 if auth.uid() is null or request_key is null then raise exception 'Sign in required'; end if;
 select * into source from public.creator_scripts where id=source_id and user_id=auth.uid();
 if source.id is null or source.finalized_at is null then raise exception 'Choose a finished video in your account'; end if;
 perform 1 from public.creator_scripts where id=source.project_id for update;
 select * into result from public.creator_scripts where user_id=auth.uid() and version_request_id=request_key;
 if result.id is not null then
  if result.parent_version_id<>source_id then raise exception 'Request belongs to another version'; end if;
  return result;
 end if;
 select * into result from public.creator_scripts where parent_version_id=source_id and finalized_at is null;
 if result.id is not null then return result; end if;
 select max(version_number)+1 into next_number from public.creator_scripts where project_id=source.project_id;
 copied=jsonb_set(source.brief,'{production}',(source.brief->'production')-'render'-'voice_preview_approval'||jsonb_build_object('step','visuals'));
 perform set_config('creator.version_create','yes',true);
 insert into public.creator_scripts(user_id,content_profile_id,title,hook,body,cta,brief,project_id,parent_version_id,version_number,version_request_id)
 values(source.user_id,source.content_profile_id,source.title,source.hook,source.body,source.cta,copied,source.project_id,source.id,next_number,request_key) returning * into result;
 perform set_config('creator.version_create','',true);
 return result;
end $$;
revoke all on function public.create_video_version(uuid,uuid) from public,anon;
grant execute on function public.create_video_version(uuid,uuid) to authenticated;
