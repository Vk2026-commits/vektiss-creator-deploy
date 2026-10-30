begin;
alter table public.creator_search_delivery_flags alter column enabled set default true;
create function public.creator_enable_search_delivery_for_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.creator_search_delivery_flags(user_id,enabled) values(new.id,true)
  on conflict(user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.creator_enable_search_delivery_for_new_user() from public,anon,authenticated;
create trigger creator_enable_search_delivery_after_signup
  after insert on auth.users for each row execute function public.creator_enable_search_delivery_for_new_user();
insert into public.creator_search_delivery_flags(user_id,enabled)
select id,true from auth.users
on conflict(user_id) do update set enabled=true;
commit;
