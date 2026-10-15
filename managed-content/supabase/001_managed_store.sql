-- Dedicated server-only storage for the managed-content site.
-- This migration creates no Creator rows and exposes no tables to anon users.
create schema if not exists managed_content_internal;

create table if not exists managed_content_internal.kv (
  key text primary key,
  value text not null,
  expires_at timestamptz
);

create table if not exists managed_content_internal.members (
  key text not null,
  member text not null,
  primary key (key, member)
);

alter table managed_content_internal.kv enable row level security;
alter table managed_content_internal.members enable row level security;

revoke all on schema managed_content_internal from public, anon, authenticated;
revoke all on all tables in schema managed_content_internal from public, anon, authenticated;
grant usage on schema managed_content_internal to service_role;
grant select, insert, update, delete on managed_content_internal.kv to service_role;
grant select, insert on managed_content_internal.members to service_role;

create or replace function public.managed_content_store(
  p_command text,
  p_key text,
  p_value text default null,
  p_nx boolean default false,
  p_ttl_seconds integer default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_value text;
  affected integer;
begin
  if p_key is null or left(p_key, 8) <> 'managed:' or length(p_key) > 300 then
    raise exception 'Invalid managed-content key';
  end if;
  if p_ttl_seconds is not null and (p_ttl_seconds < 1 or p_ttl_seconds > 86400) then
    raise exception 'Invalid managed-content TTL';
  end if;

  if p_command <> 'SADD' then
    delete from managed_content_internal.kv
    where key = p_key and expires_at is not null and expires_at <= now();
  end if;

  case p_command
    when 'GET' then
      select value into result_value from managed_content_internal.kv where key = p_key;
      return result_value;
    when 'SET' then
      if p_value is null then raise exception 'SET requires a value'; end if;
      if p_nx then
        insert into managed_content_internal.kv (key, value, expires_at)
        values (p_key, p_value, case when p_ttl_seconds is null then null else now() + make_interval(secs => p_ttl_seconds) end)
        on conflict (key) do nothing;
        get diagnostics affected = row_count;
        if affected = 0 then return null; end if;
      else
        insert into managed_content_internal.kv (key, value, expires_at)
        values (p_key, p_value, case when p_ttl_seconds is null then null else now() + make_interval(secs => p_ttl_seconds) end)
        on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
      end if;
      return 'OK';
    when 'INCR' then
      insert into managed_content_internal.kv (key, value) values (p_key, '1')
      on conflict (key) do update
        set value = ((managed_content_internal.kv.value)::bigint + 1)::text
      returning value into result_value;
      return result_value;
    when 'EXPIRE' then
      if p_ttl_seconds is null then raise exception 'EXPIRE requires a TTL'; end if;
      update managed_content_internal.kv
        set expires_at = now() + make_interval(secs => p_ttl_seconds) where key = p_key;
      get diagnostics affected = row_count;
      return affected::text;
    when 'DEL' then
      delete from managed_content_internal.kv where key = p_key;
      get diagnostics affected = row_count;
      return affected::text;
    when 'SADD' then
      if p_value is null then raise exception 'SADD requires a value'; end if;
      insert into managed_content_internal.members (key, member)
      values (p_key, p_value) on conflict do nothing;
      get diagnostics affected = row_count;
      return affected::text;
    else
      raise exception 'Unsupported managed-content command';
  end case;
end;
$$;

revoke all on function public.managed_content_store(text, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.managed_content_store(text, text, text, boolean, integer) to service_role;
