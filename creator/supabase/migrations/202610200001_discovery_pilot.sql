begin;
create table public.creator_discovery_pilot (
 content_profile_id uuid primary key references public.content_profiles(id) on delete cascade,
 enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table public.creator_discovery_watchlist (
 id uuid primary key default gen_random_uuid(), content_profile_id uuid not null references public.content_profiles(id) on delete cascade,
 user_id uuid not null references auth.users(id), platform text not null check(platform in ('TikTok','Instagram','YouTube')),
 identifier text not null check(length(identifier) between 1 and 100), url text not null check(length(url)<=2048), name text not null check(length(name)<=160),
 created_at timestamptz not null default now(), unique(content_profile_id,platform,identifier)
);
alter table public.creator_discovery_pilot enable row level security;
alter table public.creator_discovery_watchlist enable row level security;
revoke all on public.creator_discovery_pilot,public.creator_discovery_watchlist from anon,authenticated;
grant select on public.creator_discovery_pilot to authenticated;
grant select,insert,delete on public.creator_discovery_watchlist to authenticated;
grant all on public.creator_discovery_pilot,public.creator_discovery_watchlist to service_role;
create policy discovery_pilot_read on public.creator_discovery_pilot for select to authenticated using(exists(select 1 from public.content_profiles p where p.id=content_profile_id and p.user_id=(select auth.uid())));
create policy discovery_watchlist_read on public.creator_discovery_watchlist for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.content_profiles p where p.id=content_profile_id and p.user_id=(select auth.uid())));
create policy discovery_watchlist_insert on public.creator_discovery_watchlist for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.content_profiles p where p.id=content_profile_id and p.user_id=(select auth.uid())));
create policy discovery_watchlist_delete on public.creator_discovery_watchlist for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.content_profiles p where p.id=content_profile_id and p.user_id=(select auth.uid())));
insert into public.creator_discovery_pilot(content_profile_id,enabled) select id,false from public.content_profiles where id='3ea48507-fd4b-45bd-acfe-11d73489d867' and user_id='eb604937-97ba-40fc-b949-b1e336461b0a';
commit;
