begin;
alter table public.creator_ai_generations add column project_id uuid;
alter table public.creator_ai_generations add column pricing_version text;
create index creator_ai_project_costs on public.creator_ai_generations(user_id,project_id);

-- Application telemetry, not provider-invoiced charges. Jobs use an idempotent UUID.
create table public.creator_processing_usage (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid,
 retry_of uuid references public.creator_processing_usage(id),
 operation text not null check(length(operation)<=120),
 status text not null check(status in ('running','done','failed','interrupted')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 elapsed_ms bigint check(elapsed_ms>=0),
 upload_bytes bigint check(upload_bytes>=0),
 retained_bytes bigint check(retained_bytes>=0),
 assets jsonb not null default '[]' check(jsonb_typeof(assets)='array' and octet_length(assets::text)<100000),
 basis text not null default 'application_reported' check(basis='application_reported')
);
create index creator_processing_project on public.creator_processing_usage(user_id,project_id);
alter table public.creator_processing_usage enable row level security;
revoke all on public.creator_processing_usage from anon,authenticated;
grant select,insert,update on public.creator_processing_usage to authenticated;
grant all on public.creator_processing_usage to service_role;
create policy usage_owner on public.creator_processing_usage to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Explicit human entries: never masquerade as measured provider usage.
create table public.creator_cost_entries (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 kind text not null check(kind in ('heygen','support')),
 render_id uuid references public.creator_presenter_tests(id),
 quantity numeric not null check(quantity>=0 and quantity<=1000000),
 unit_rate_usd numeric not null check(unit_rate_usd>=0 and unit_rate_usd<=100000),
 note text not null default '' check(length(note)<=1000),
 created_at timestamptz not null default now(),
 check((kind='heygen' and render_id is not null) or (kind='support' and render_id is null)),
 unique(render_id)
);
alter table public.creator_cost_entries enable row level security;
revoke all on public.creator_cost_entries from anon,authenticated;
grant select,insert on public.creator_cost_entries to authenticated;
grant all on public.creator_cost_entries to service_role;
create policy cost_read on public.creator_cost_entries for select to authenticated using(user_id=(select auth.uid()));
create policy cost_insert on public.creator_cost_entries for insert to authenticated with check(
 user_id=(select auth.uid()) and (render_id is null or exists (
 select 1 from public.creator_presenter_tests r join public.creator_scripts s on s.id=r.script_id
 where r.id=render_id and r.user_id=(select auth.uid()) and coalesce(nullif(s.brief->>'cost_project_id',''),s.id::text)=project_id::text
 ))
);
commit;
