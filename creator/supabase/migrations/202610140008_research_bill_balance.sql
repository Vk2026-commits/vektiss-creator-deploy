begin;
-- Owner confirmed this Perplexity project serves only Vektiss Creator.
-- The console displayed $5.79 for Sep 14–Oct 14. This is a rounded billing
-- total, not a per-request invoice. Keep the unexplained balance unallocated.
create table if not exists public.creator_research_bill_reconciliations (
 id uuid primary key references public.creator_shared_costs(id),
 total_usd numeric not null check(total_usd>=0),
 usage_ids uuid[] not null
);
alter table public.creator_research_bill_reconciliations enable row level security;
revoke all on public.creator_research_bill_reconciliations from public,anon,authenticated;
grant all on public.creator_research_bill_reconciliations to service_role;
insert into public.creator_shared_costs(id,provider,amount_usd,period_start,period_end,basis,note,created_by)
values('861439e5-f838-47b8-8a1e-d60e5262cf25','Perplexity · unallocated balance',0,'2026-09-14','2026-10-14','estimate',
 'Provider dashboard total $5.79, displayed rounded to cents. Only the balance not already recorded per request is added here. Creator allocation remains unknown; historical failed requests remain under review. Owner confirmed Creator-only use. Partial date filters prorate this balance.',
 'eb604937-97ba-40fc-b949-b1e336461b0a') on conflict(id) do nothing;
insert into public.creator_research_bill_reconciliations(id,total_usd,usage_ids)
select '861439e5-f838-47b8-8a1e-d60e5262cf25',5.79,coalesce(array_agg(id),'{}'::uuid[])
from public.creator_research_usage where created_at>='2026-09-14T00:00:00Z' and created_at<'2026-10-15T00:00:00Z'
on conflict(id) do nothing;

create or replace function public.creator_refresh_research_bill_balance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.creator_shared_costs s set amount_usd=greatest(0,b.total_usd-coalesce((
 select sum(u.provider_cost_usd) from public.creator_research_usage u where u.id=any(b.usage_ids)),0))
 from public.creator_research_bill_reconciliations b where s.id=b.id;
 return null;
end $$;
revoke all on function public.creator_refresh_research_bill_balance() from public,anon,authenticated;
drop trigger if exists creator_research_bill_balance on public.creator_research_usage;
create trigger creator_research_bill_balance after update of provider_cost_usd or delete on public.creator_research_usage
for each statement execute function public.creator_refresh_research_bill_balance();
update public.creator_shared_costs s set amount_usd=greatest(0,b.total_usd-coalesce((
 select sum(u.provider_cost_usd) from public.creator_research_usage u where u.id=any(b.usage_ids)),0))
from public.creator_research_bill_reconciliations b where s.id=b.id;
commit;
