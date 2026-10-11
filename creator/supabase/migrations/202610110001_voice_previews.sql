-- Reserve before calling the billable provider, including across tabs/workers.
create table if not exists public.creator_voice_previews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null references public.provider_connections(id) on delete cascade,
 revision text not null,
 status text not null default 'pending' check(status in ('pending','completed','uncertain')),
 settings jsonb not null,
 result jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,connection_id,revision)
);
alter table public.creator_voice_previews enable row level security;
revoke all on public.creator_voice_previews from anon, authenticated;
grant all on public.creator_voice_previews to service_role;
