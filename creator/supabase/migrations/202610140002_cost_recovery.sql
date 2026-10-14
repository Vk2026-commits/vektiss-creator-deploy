begin;
create table public.creator_cost_recovery_attempts(provider text,id text,checked_at timestamptz not null default now(),primary key(provider,id));
alter table public.creator_cost_recovery_attempts enable row level security;
revoke all on public.creator_cost_recovery_attempts from public,anon,authenticated;
grant all on public.creator_cost_recovery_attempts to service_role;
create table public.creator_cost_recovery_state(id boolean primary key default true check(id),last_started timestamptz);
alter table public.creator_cost_recovery_state enable row level security;
revoke all on public.creator_cost_recovery_state from public,anon,authenticated;
insert into public.creator_cost_recovery_state(id) values(true);
create function public.creator_claim_cost_recovery() returns boolean language sql security definer set search_path='' as $$
 with claimed as(update public.creator_cost_recovery_state set last_started=now() where id and (last_started is null or last_started<now()-interval '2 minutes') returning id) select exists(select 1 from claimed);
$$;
create function public.creator_save_cost_duration(p_id uuid,p_seconds numeric) returns void language sql security definer set search_path='' as $$
 update public.creator_presenter_tests set snapshot=jsonb_set(snapshot,'{provider_duration_seconds}',to_jsonb(p_seconds)) where id=p_id and p_seconds>0 and p_seconds<86400;
$$;
revoke all on function public.creator_claim_cost_recovery(),public.creator_save_cost_duration(uuid,numeric) from public,anon,authenticated;
grant execute on function public.creator_claim_cost_recovery(),public.creator_save_cost_duration(uuid,numeric) to service_role;
commit;
