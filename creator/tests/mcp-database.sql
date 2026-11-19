-- Run after applying the migration; rolls back every test write.
begin;

do $$
declare u uuid; p uuid; u2 uuid; p2 uuid; n integer; c uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); d jsonb; a jsonb; b jsonb;
begin
 if has_schema_privilege('creator_mcp','public','usage') then raise exception 'Connector can access public schema'; end if;
 if not has_schema_privilege('authenticated','public','usage') then raise exception 'Normal sessions blocked'; end if;
 select user_id,id into u,p from public.content_profiles limit 1;
 insert into public.creator_mcp_pilots values(u,true) on conflict(user_id) do update set enabled=true;
 insert into public.creator_mcp_connections(user_id,client_id,client_name) values(u,c,'Mock client');
 d:=jsonb_build_object('content_profile_id',p,'title','Mock MCP test','hook','','body','','cta','','brief','{}'::jsonb);
 a:=public.creator_mcp_save(u,c,d,null,null,k);b:=public.creator_mcp_save(u,c,d,null,null,k);
 if a->>'id'<>b->>'id' then raise exception 'Duplicate project'; end if;
 b:=public.creator_mcp_save(u,c,d,(a->>'id')::uuid,'2000-01-01',null);
 if b->>'conflict'<>'true' then raise exception 'Missing conflict'; end if;
 b:=public.creator_mcp_token_hook(jsonb_build_object('user_id',u,'claims',jsonb_build_object('role','authenticated','client_id',c)));
 if b->'claims'->>'role'<>'creator_mcp' or b->'claims'->>'aud'<>'https://creator.vektiss.com/api/mcp' or b->'claims'->>'creator_mcp_grant' is null then raise exception 'Unsafe OAuth role'; end if;
 b:=public.creator_mcp_token_hook(jsonb_build_object('user_id',u,'claims',jsonb_build_object('role','authenticated')));
 if b->'claims'->>'role'<>'authenticated' then raise exception 'Normal role changed'; end if;

 select user_id,id into u2,p2 from public.content_profiles where user_id<>u limit 1;
 if u2 is not null then
  insert into public.creator_mcp_pilots values(u2,true) on conflict(user_id) do update set enabled=true;
  insert into public.creator_mcp_connections(user_id,client_id,client_name) values(u2,c,'Other mock client');
  begin perform public.creator_mcp_save(u2,c,d,(a->>'id')::uuid,(a->>'updated_at')::timestamptz,null);raise exception 'Foreign profile accepted';exception when raise_exception then if sqlerrm<>'MCP_PROFILE_NOT_FOUND' then raise;end if;end;
  begin perform public.creator_mcp_save(u2,c,jsonb_set(d,'{content_profile_id}',to_jsonb(p2)),(a->>'id')::uuid,(a->>'updated_at')::timestamptz,null);raise exception 'Foreign project accepted';exception when raise_exception then if sqlerrm<>'MCP_PROJECT_NOT_FOUND' then raise;end if;end;
 end if;
 begin perform public.creator_mcp_save(u,c,jsonb_set(d,'{title}','"Changed"'),null,null,k);raise exception 'Reused key accepted different payload';exception when raise_exception then if sqlerrm<>'MCP_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 update public.creator_scripts set brief='{"production":{"render":{"status":"ready","export_id":"mock-only"}}}'::jsonb where id=(a->>'id')::uuid ;
 select to_jsonb(x) into b from public.creator_scripts x where id=(a->>'id')::uuid;
 begin perform public.creator_mcp_save(u,c,d,(a->>'id')::uuid,(b->>'updated_at')::timestamptz,null);raise exception 'Finished project changed';exception when raise_exception then if sqlerrm<>'MCP_RENDER_LOCKED' then raise;end if;end;

 update public.creator_mcp_connections set revoked_at=now() where user_id=u and client_id=c;
 begin perform public.creator_mcp_enter(u,c,'test');raise exception 'Revoked connection allowed';exception when raise_exception then if sqlerrm<>'MCP_ACCESS_DENIED' then raise;end if;end;
end $$;
rollback;
