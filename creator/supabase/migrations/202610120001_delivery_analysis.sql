-- Operational metadata only. Never store reference audio, transcripts or
-- unapproved suggestions. Approved preferences live in creator_profiles.context.
create table if not exists public.creator_delivery_analyses (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'processing' check(status in ('processing','complete','failed','uncertain')),
 model text not null,
 duration_seconds numeric,
 usage jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.creator_delivery_analyses enable row level security;
revoke all on public.creator_delivery_analyses from anon,authenticated;
grant select on public.creator_delivery_analyses to authenticated;
grant all on public.creator_delivery_analyses to service_role;
create policy delivery_analysis_owner on public.creator_delivery_analyses for select to authenticated using(user_id=auth.uid());
