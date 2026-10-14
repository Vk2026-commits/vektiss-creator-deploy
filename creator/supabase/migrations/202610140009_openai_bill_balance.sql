begin;
create table if not exists public.creator_openai_bill_reconciliations (
 id uuid primary key references public.creator_shared_costs(id),
 total_usd numeric not null check(total_usd>=0), usage_ids uuid[] not null
);
alter table public.creator_openai_bill_reconciliations enable row level security;
revoke all on public.creator_openai_bill_reconciliations from public,anon,authenticated;
grant all on public.creator_openai_bill_reconciliations to service_role;
insert into public.creator_shared_costs(id,provider,amount_usd,period_start,period_end,basis,note,created_by)
values('76ad7ce0-623a-4584-af95-216a13df19ee','OpenAI · unallocated balance',0,'2026-09-14','2026-10-14','estimate',
 'OpenAI Default project displayed $5.38 for Sep 14–Oct 14, verified 2026-10-14. Owner confirmed Creator-only use. This adds only the difference above saved request estimates; it is not an extra bill. Individual allocation remains estimated and old failures remain unresolved. Partial date filters prorate this balance.',
 'eb604937-97ba-40fc-b949-b1e336461b0a') on conflict(id) do nothing;
insert into public.creator_openai_bill_reconciliations(id,total_usd,usage_ids)
select '76ad7ce0-623a-4584-af95-216a13df19ee',5.38,coalesce(array_agg(id),'{}'::uuid[])
from public.creator_ai_generations where created_at>='2026-09-14T00:00:00Z' and created_at<'2026-10-15T00:00:00Z'
on conflict(id) do nothing;
create or replace function public.creator_refresh_openai_bill_balance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.creator_shared_costs s set amount_usd=greatest(0,b.total_usd-coalesce((
 select sum(u.estimated_cost_usd) from public.creator_ai_generations u where u.id=any(b.usage_ids)),0))
 from public.creator_openai_bill_reconciliations b where s.id=b.id;
 return null;
end $$;
revoke all on function public.creator_refresh_openai_bill_balance() from public,anon,authenticated;
drop trigger if exists creator_openai_bill_balance on public.creator_ai_generations;
create trigger creator_openai_bill_balance after update of estimated_cost_usd or delete on public.creator_ai_generations
for each statement execute function public.creator_refresh_openai_bill_balance();
update public.creator_shared_costs s set amount_usd=greatest(0,b.total_usd-coalesce((
 select sum(u.estimated_cost_usd) from public.creator_ai_generations u where u.id=any(b.usage_ids)),0))
from public.creator_openai_bill_reconciliations b where s.id=b.id;
commit;
