-- Connector tokens are deliberately NOT members of authenticated/anon.
do $$ begin if not exists(select 1 from pg_roles where rolname='creator_mcp') then create role creator_mcp nologin noinherit; end if; end $$;
grant creator_mcp to authenticator;
-- Existing application roles already have explicit USAGE; remove the PUBLIC fallback.
revoke usage on schema public from public;
grant usage on schema public to anon,authenticated,service_role,supabase_auth_admin;

create table public.creator_mcp_pilots(user_id uuid primary key references auth.users(id) on delete cascade,enabled boolean not null default false);
create table public.creator_mcp_connections(user_id uuid references auth.users(id) on delete cascade,client_id uuid not null,client_name text not null,approved_at timestamptz not null default now(),revoked_at timestamptz,primary key(user_id,client_id));
create table public.creator_mcp_audit(id bigint generated always as identity primary key,user_id uuid not null,client_id uuid not null,tool text not null,project_id uuid,outcome text not null,created_at timestamptz not null default now());
create index creator_mcp_audit_rate on public.creator_mcp_audit(user_id,created_at);
create table public.creator_mcp_requests(user_id uuid not null,request_key uuid not null,project_id uuid not null references public.creator_scripts(id),input_hash text not null,primary key(user_id,request_key));
alter table public.creator_mcp_pilots enable row level security;
alter table public.creator_mcp_connections enable row level security;
alter table public.creator_mcp_audit enable row level security;
alter table public.creator_mcp_requests enable row level security;
revoke all on public.creator_mcp_pilots,public.creator_mcp_connections,public.creator_mcp_audit,public.creator_mcp_requests from anon,authenticated;
grant all on public.creator_mcp_pilots,public.creator_mcp_connections,public.creator_mcp_audit,public.creator_mcp_requests to service_role;
grant usage,select on sequence public.creator_mcp_audit_id_seq to service_role;
grant select on public.creator_mcp_pilots to authenticated;
grant select,insert,update on public.creator_mcp_connections to authenticated;
create policy mcp_pilot_read on public.creator_mcp_pilots for select to authenticated using(user_id=auth.uid() and (auth.jwt()->>'client_id') is null);
create policy mcp_connection_owner on public.creator_mcp_connections for all to authenticated using(user_id=auth.uid() and (auth.jwt()->>'client_id') is null) with check(user_id=auth.uid() and (auth.jwt()->>'client_id') is null and exists(select 1 from public.creator_mcp_pilots p where p.user_id=auth.uid() and p.enabled));

-- Configure as the project's custom access-token hook before enabling OAuth.
create function public.creator_mcp_token_hook(event jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; begin
 if coalesce(claims->>'client_id',event->>'client_id') is not null then
  claims:=jsonb_set(claims,'{role}','"creator_mcp"');
  claims:=jsonb_set(claims,'{aud}','"https://creator.vektiss.com/api/mcp"');
  claims:=jsonb_set(claims,'{client_id}',to_jsonb(coalesce(claims->>'client_id',event->>'client_id')));
  claims:=jsonb_set(claims,'{creator_mcp_grant}',coalesce((select to_jsonb(approved_at::text) from public.creator_mcp_connections where user_id=(event->>'user_id')::uuid and client_id=(claims->>'client_id')::uuid and revoked_at is null),'null'::jsonb));
 end if;
 return jsonb_set(event,'{claims}',claims);
end $$;
revoke all on function public.creator_mcp_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.creator_mcp_token_hook(jsonb) to supabase_auth_admin;

create function public.creator_mcp_enter(p_user uuid,p_client uuid,p_tool text) returns bigint language plpgsql security definer set search_path='' as $$
declare audit_id bigint; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from public.creator_mcp_pilots where user_id=p_user and enabled) or not exists(select 1 from public.creator_mcp_connections where user_id=p_user and client_id=p_client and revoked_at is null) then raise exception 'MCP_ACCESS_DENIED'; end if;
 if (select count(*) from public.creator_mcp_audit where user_id=p_user and created_at>now()-interval '1 minute')>=60 then raise exception 'MCP_RATE_LIMIT'; end if;
 insert into public.creator_mcp_audit(user_id,client_id,tool,outcome) values(p_user,p_client,p_tool,'started') returning id into audit_id;
 return audit_id;
end $$;
revoke all on function public.creator_mcp_enter(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.creator_mcp_enter(uuid,uuid,text) to service_role;

create function public.creator_mcp_save(p_user uuid,p_client uuid,p_input jsonb,p_project uuid default null,p_revision timestamptz default null,p_key uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.creator_scripts; cached public.creator_mcp_requests; fingerprint text:=md5(p_input::text); begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from public.creator_mcp_pilots where user_id=p_user and enabled) or not exists(select 1 from public.creator_mcp_connections where user_id=p_user and client_id=p_client and revoked_at is null) then raise exception 'MCP_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.content_profiles where id=(p_input->>'content_profile_id')::uuid and user_id=p_user) then raise exception 'MCP_PROFILE_NOT_FOUND'; end if;
 if p_project is null then
  if p_key is null then raise exception 'MCP_IDEMPOTENCY_REQUIRED'; end if;
  select * into cached from public.creator_mcp_requests where user_id=p_user and request_key=p_key;
  if found then
   if cached.input_hash<>fingerprint then raise exception 'MCP_IDEMPOTENCY_CONFLICT'; end if;
   select * into row from public.creator_scripts where id=cached.project_id and user_id=p_user;
   return to_jsonb(row);
  end if;
  insert into public.creator_scripts(user_id,content_profile_id,title,hook,body,cta,brief) values(p_user,(p_input->>'content_profile_id')::uuid,p_input->>'title',p_input->>'hook',p_input->>'body',p_input->>'cta',p_input->'brief') returning * into row;
  insert into public.creator_mcp_requests values(p_user,p_key,row.id,fingerprint);
 else
  select * into row from public.creator_scripts where id=p_project and user_id=p_user for update;
  if not found then raise exception 'MCP_PROJECT_NOT_FOUND'; end if;
  if p_revision is null or row.updated_at<>p_revision then return jsonb_build_object('conflict',true,'revision',row.updated_at); end if;
  if row.finalized_at is not null or row.brief->'production'->'render' is not null then raise exception 'MCP_RENDER_LOCKED'; end if;
  update public.creator_scripts set title=p_input->>'title',hook=p_input->>'hook',body=p_input->>'body',cta=p_input->>'cta',brief=p_input->'brief',updated_at=clock_timestamp() where id=p_project and user_id=p_user returning * into row;
 end if;
 return to_jsonb(row);
end $$;
revoke all on function public.creator_mcp_save(uuid,uuid,jsonb,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.creator_mcp_save(uuid,uuid,jsonb,uuid,timestamptz,uuid) to service_role;
