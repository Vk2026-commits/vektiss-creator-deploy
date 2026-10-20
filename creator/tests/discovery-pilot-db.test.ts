import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
it('isolates watchlists, rejects cross-owner changes, deduplicates accounts, and seeds only the disabled pilot',async()=>{
 const db=new PGlite();const owner='eb604937-97ba-40fc-b949-b1e336461b0a',other='00000000-0000-4000-8000-000000000001',pilot='3ea48507-fd4b-45bd-acfe-11d73489d867',second='00000000-0000-4000-8000-000000000002';
 try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);create table content_profiles(id uuid primary key,user_id uuid);
 create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid',true)::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;grant select on content_profiles to authenticated;`);
 await db.query('insert into auth.users values($1),($2)',[owner,other]);await db.query('insert into content_profiles values($1,$3),($2,$4)',[pilot,second,owner,other]);
 await db.exec(await readFile('supabase/migrations/202610200001_discovery_pilot.sql','utf8'));
 expect((await db.query('select content_profile_id,enabled from creator_discovery_pilot')).rows).toEqual([{content_profile_id:pilot,enabled:false}]);
 await db.exec(`set role authenticated;set "test.uid"='${owner}'`);
 await db.query("insert into creator_discovery_watchlist(content_profile_id,user_id,platform,identifier,url,name) values($1,$2,'YouTube','@example','https://www.youtube.com/@example','Example')",[pilot,owner]);
 await expect(db.query("insert into creator_discovery_watchlist(content_profile_id,user_id,platform,identifier,url,name) values($1,$2,'YouTube','@example','https://www.youtube.com/@example','Example')",[pilot,owner])).rejects.toThrow(/unique/);
 await expect(db.query("insert into creator_discovery_watchlist(content_profile_id,user_id,platform,identifier,url,name) values($1,$2,'YouTube','@example','https://www.youtube.com/@example','Example')",[second,owner])).rejects.toThrow(/row-level security/);
 await db.exec(`set "test.uid"='${other}'`);expect((await db.query('select * from creator_discovery_watchlist')).rows).toHaveLength(0);expect((await db.query('select * from creator_discovery_pilot')).rows).toHaveLength(0);
 await db.query('delete from creator_discovery_watchlist where content_profile_id=$1',[pilot]);
 await db.exec(`set "test.uid"='${owner}'`);expect((await db.query('select * from creator_discovery_watchlist')).rows).toHaveLength(1);
 await db.query('delete from creator_discovery_watchlist where content_profile_id=$1',[pilot]);expect((await db.query('select * from creator_discovery_watchlist')).rows).toHaveLength(0);
 }finally{await db.close();}
});
