begin;
create table if not exists private.creator_ai_scoped_limits (
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket text not null check(bucket in ('writing','analysis')),
 window_start timestamptz not null,
 calls integer not null,
 primary key(user_id,bucket)
);
revoke all on private.creator_ai_scoped_limits from public,anon,authenticated;
create or replace function public.creator_ai_allow_scoped(p_user uuid,p_bucket text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare allowance integer; n integer; started timestamptz;
begin
 if p_bucket not in ('writing','analysis') then raise exception 'Invalid AI bucket'; end if;
 if auth.role()<>'service_role' and (auth.uid() is null or auth.uid()<>p_user) then raise exception 'Forbidden'; end if;
 if p_bucket='writing' then
  select hourly_limit into allowance from private.creator_ai_limit_overrides where user_id=p_user and expires_at>now();
 end if;
 allowance:=coalesce(allowance,case when p_bucket='analysis' then 120 else 20 end);
 insert into private.creator_ai_scoped_limits as limits values(p_user,p_bucket,now(),1)
 on conflict(user_id,bucket) do update set
 calls=case when limits.window_start<=now()-interval '1 hour' then 1 else least(limits.calls+1,allowance+1) end,
 window_start=case when limits.window_start<=now()-interval '1 hour' then now() else limits.window_start end
 returning calls,window_start into n,started;
 return jsonb_build_object('allowed',n<=allowance,'retryAt',started+interval '1 hour','bucket',p_bucket);
end $$;
revoke all on function public.creator_ai_allow_scoped(uuid,text) from public,anon,authenticated;
grant execute on function public.creator_ai_allow_scoped(uuid,text) to service_role;
commit;
