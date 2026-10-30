-- Server-owned state. Clients use creative-manager, never write these rows directly.
create table if not exists public.creator_creative_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false
);
create table if not exists public.creator_creative_jobs (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null references public.provider_connections(id),
 kind text not null check(kind in ('image','look','kit','agent','message')),
 status text not null default 'submitting', provider_id text,
 title text not null, input jsonb not null default '{}', result jsonb not null default '{}', error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists creator_creative_jobs_owner on public.creator_creative_jobs(user_id,created_at desc);
create table if not exists public.creator_creative_assets (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null references public.provider_connections(id), provider_id text not null,
 name text not null, created_at timestamptz not null default now()
);
create table if not exists public.creator_creative_brand (
 user_id uuid primary key references auth.users(id) on delete cascade,
 connection_id uuid not null references public.provider_connections(id), kit_id text not null,
 updated_at timestamptz not null default now()
);
alter table public.creator_creative_access enable row level security;
alter table public.creator_creative_jobs enable row level security;
alter table public.creator_creative_assets enable row level security;
alter table public.creator_creative_brand enable row level security;
revoke all on public.creator_creative_access, public.creator_creative_jobs, public.creator_creative_assets, public.creator_creative_brand from anon, authenticated;
grant all on public.creator_creative_access, public.creator_creative_jobs, public.creator_creative_assets, public.creator_creative_brand to service_role;

create unique index if not exists creator_creative_one_saved_look on public.creator_creative_jobs(user_id,(input->>'image_job_id')) where kind='look';

create unique index if not exists creator_creative_one_instruction_per_turn on public.creator_creative_jobs(user_id,(input->>'job_id'),(input->>'turn')) where kind='message';
