-- Only trusted server verification may unlock paid full renders.
create table public.creator_avatar_verifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null references public.provider_connections(id) on delete cascade,
 avatar_id uuid not null references public.avatar_profiles(id) on delete cascade,
 engine text not null check (engine in ('avatar_iii','avatar_iv','avatar_v')),
 aspect_ratio text not null check (aspect_ratio in ('9:16','16:9','1:1')),
 thumbnail_url text,
 test_id uuid not null references public.creator_presenter_tests(id) on delete cascade,
 verification_version integer not null check (verification_version=1),
 crop jsonb not null,
 source_width integer not null check(source_width between 32 and 2048),
 source_height integer not null check(source_height between 32 and 2048),
 verified_at timestamptz not null default now(),
 unique(user_id,connection_id,avatar_id,engine,aspect_ratio)
);
alter table public.creator_avatar_verifications enable row level security;
revoke all on public.creator_avatar_verifications from anon,authenticated;
grant select on public.creator_avatar_verifications to authenticated;
grant all on public.creator_avatar_verifications to service_role;
create policy avatar_verification_owner_read on public.creator_avatar_verifications
 for select to authenticated using (user_id=(select auth.uid()));
