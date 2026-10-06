begin;

-- Research is explicitly off until a pilot account is entitled.
create table public.creator_research_config (
  id boolean primary key default true check (id),
  feature_enabled boolean not null default false,
  default_monthly_opportunity_limit integer not null default 150 check (default_monthly_opportunity_limit between 1 and 10000),
  candidate_multiplier numeric(4,2) not null default 2.00 check (candidate_multiplier >= 1 and candidate_multiplier <= 5),
  updated_at timestamptz not null default now()
);
insert into public.creator_research_config (id) values (true) on conflict (id) do nothing;

create table public.creator_research_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  monthly_opportunity_limit integer not null default 150 check (monthly_opportunity_limit between 1 and 10000),
  period_start date not null default date_trunc('month', timezone('utc', now()))::date,
  delivered_count integer not null default 0 check (delivered_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_research_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_profile_id uuid not null,
  idempotency_key uuid not null,
  provider text not null default 'perplexity' check (provider = 'perplexity'),
  provider_response_id text unique,
  requested_count integer not null check (requested_count in (10, 20, 30)),
  reserved_count integer not null check (reserved_count >= 0),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  status text not null default 'queued' check (status in ('queued','researching','reviewing_sources','ranking','ready','failed','cancelled')),
  phase text not null default 'Researching…' check (length(phase) <= 120),
  error_code text check (length(error_code) <= 120),
  input_snapshot jsonb not null default '{}' check (jsonb_typeof(input_snapshot) = 'object' and pg_column_size(input_snapshot) < 100000),
  provider_metadata jsonb not null default '{}' check (jsonb_typeof(provider_metadata) = 'object' and pg_column_size(provider_metadata) < 100000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (content_profile_id, user_id) references public.content_profiles(id, user_id) on delete cascade
);
create index creator_research_jobs_owner on public.creator_research_jobs(user_id, created_at desc);
create index creator_research_jobs_active on public.creator_research_jobs(user_id, status, updated_at desc);

create table public.creator_research_sources (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_url text not null check (canonical_url ~* '^https://'),
  title text not null check (length(title) between 1 and 300),
  snippet text not null default '' check (length(snippet) <= 6000),
  source_type text not null default 'web' check (length(source_type) <= 80),
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  provider text not null default 'perplexity' check (provider = 'perplexity'),
  provider_source_id integer,
  created_at timestamptz not null default now(),
  unique (user_id, canonical_url)
);
create index creator_research_sources_owner on public.creator_research_sources(user_id, published_at desc);

create table public.creator_research_opportunities (
  id uuid primary key,
  job_id uuid not null references public.creator_research_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content_profile_id uuid not null,
  normalized_title text not null check (length(normalized_title) between 1 and 400),
  title text not null check (length(title) between 1 and 220),
  factual_summary text not null check (length(factual_summary) between 1 and 2500),
  why_audience_cares text not null check (length(why_audience_cares) between 1 and 1800),
  creator_connection text not null check (length(creator_connection) between 1 and 1800),
  recommended_angle text not null check (length(recommended_angle) between 1 and 1800),
  suggested_hook text not null default '' check (length(suggested_hook) <= 500),
  category text not null check (length(category) between 1 and 120),
  published_at timestamptz,
  timeliness_score numeric(5,2) not null check (timeliness_score between 0 and 100),
  relevance_score numeric(5,2) not null check (relevance_score between 0 and 100),
  rank_score numeric(5,2) not null check (rank_score between 0 and 100),
  uncertainty text not null default '' check (length(uncertainty) <= 1000),
  evidence_state text not null default 'source_backed' check (evidence_state in ('source_backed','partial','conflicting')),
  source_snapshot jsonb not null default '[]' check (jsonb_typeof(source_snapshot) = 'array' and pg_column_size(source_snapshot) < 100000),
  status text not null default 'new' check (status in ('new','saved','rejected','selected','turned_into_content')),
  selected_script_id uuid references public.creator_scripts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_profile_id, user_id) references public.content_profiles(id, user_id) on delete cascade
);
create index creator_research_opportunities_feed on public.creator_research_opportunities(user_id, content_profile_id, status, created_at desc);
create index creator_research_opportunities_title on public.creator_research_opportunities(user_id, normalized_title);

create table public.creator_research_opportunity_sources (
  opportunity_id uuid not null references public.creator_research_opportunities(id) on delete cascade,
  source_id uuid not null references public.creator_research_sources(id) on delete cascade,
  source_order smallint not null check (source_order between 1 and 6),
  primary key (opportunity_id, source_id),
  unique (opportunity_id, source_order)
);

create table public.creator_research_feedback (
  id uuid primary key,
  opportunity_id uuid not null references public.creator_research_opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('shown','saved','rejected','selected','angle_refined','script_created','turned_into_content')),
  reason text check (reason is null or reason in ('not_relevant','already_talked_about_this','dont_like_this_topic','too_old','not_my_audience','wrong_angle','other')),
  note text not null default '' check (length(note) <= 1000),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) < 10000),
  created_at timestamptz not null default now()
);
create index creator_research_feedback_owner on public.creator_research_feedback(user_id, created_at desc);
create index creator_research_feedback_opportunity on public.creator_research_feedback(opportunity_id, created_at desc);

create table public.creator_research_usage (
  id uuid primary key,
  job_id uuid not null references public.creator_research_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'perplexity' check (provider = 'perplexity'),
  operation text not null check (operation in ('deep_research_start','deep_research_complete','deep_research_failed')),
  provider_response_id text,
  model text,
  status text not null check (status in ('started','completed','failed','incomplete','cancelled')),
  request_metadata jsonb not null default '{}' check (jsonb_typeof(request_metadata) = 'object' and pg_column_size(request_metadata) < 30000),
  usage jsonb not null default '{}' check (jsonb_typeof(usage) = 'object' and pg_column_size(usage) < 100000),
  provider_cost_usd numeric(14,8) check (provider_cost_usd >= 0),
  pricing_version text,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  elapsed_ms bigint check (elapsed_ms >= 0),
  created_at timestamptz not null default now()
);
create index creator_research_usage_owner on public.creator_research_usage(user_id, created_at desc);
create index creator_research_usage_job on public.creator_research_usage(job_id, created_at desc);

-- The research tables are customer-private. Edge Functions use the service role to perform controlled writes.
alter table public.creator_research_config enable row level security;
alter table public.creator_research_entitlements enable row level security;
alter table public.creator_research_jobs enable row level security;
alter table public.creator_research_sources enable row level security;
alter table public.creator_research_opportunities enable row level security;
alter table public.creator_research_opportunity_sources enable row level security;
alter table public.creator_research_feedback enable row level security;
alter table public.creator_research_usage enable row level security;

revoke all on public.creator_research_config, public.creator_research_entitlements, public.creator_research_jobs, public.creator_research_sources, public.creator_research_opportunities, public.creator_research_opportunity_sources, public.creator_research_feedback, public.creator_research_usage from anon, authenticated;
grant select on public.creator_research_jobs, public.creator_research_sources, public.creator_research_opportunities, public.creator_research_opportunity_sources, public.creator_research_feedback, public.creator_research_usage to authenticated;
grant all on public.creator_research_config, public.creator_research_entitlements, public.creator_research_jobs, public.creator_research_sources, public.creator_research_opportunities, public.creator_research_opportunity_sources, public.creator_research_feedback, public.creator_research_usage to service_role;

create policy creator_research_jobs_read on public.creator_research_jobs for select to authenticated using (user_id = (select auth.uid()));
create policy creator_research_sources_read on public.creator_research_sources for select to authenticated using (user_id = (select auth.uid()));
create policy creator_research_opportunities_read on public.creator_research_opportunities for select to authenticated using (user_id = (select auth.uid()));
create policy creator_research_opportunity_sources_read on public.creator_research_opportunity_sources for select to authenticated using (exists (select 1 from public.creator_research_opportunities o where o.id = opportunity_id and o.user_id = (select auth.uid())));
create policy creator_research_feedback_read on public.creator_research_feedback for select to authenticated using (user_id = (select auth.uid()));
create policy creator_research_usage_read on public.creator_research_usage for select to authenticated using (user_id = (select auth.uid()));

-- This is intentionally service-role only. Use it from a protected administrative workflow or the SQL editor during the pilot.
create or replace function public.creator_research_set_pilot_entitlement(
  p_user_id uuid,
  p_enabled boolean,
  p_monthly_opportunity_limit integer default 150,
  p_note text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_monthly_opportunity_limit < 1 or p_monthly_opportunity_limit > 10000 then
    raise exception 'RESEARCH_LIMIT_INVALID';
  end if;
  if length(p_note) > 1000 then
    raise exception 'RESEARCH_NOTE_TOO_LONG';
  end if;
  insert into public.creator_research_entitlements (user_id, enabled, monthly_opportunity_limit, note)
  values (p_user_id, p_enabled, p_monthly_opportunity_limit, p_note)
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    monthly_opportunity_limit = excluded.monthly_opportunity_limit,
    note = excluded.note,
    updated_at = now();
end;
$$;
revoke all on function public.creator_research_set_pilot_entitlement(uuid, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.creator_research_set_pilot_entitlement(uuid, boolean, integer, text) to service_role;

commit;
