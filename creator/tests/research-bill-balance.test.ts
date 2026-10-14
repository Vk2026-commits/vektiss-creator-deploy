import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('adds only the unallocated balance and reduces it as historical costs recover',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table creator_shared_costs(id uuid primary key,provider text,amount_usd numeric,period_start date,period_end date,basis text,note text,created_by uuid);
 create table creator_research_usage(id uuid primary key,provider_cost_usd numeric,created_at timestamptz);
 insert into creator_research_usage values('00000000-0000-4000-8000-000000000001',4.44571,'2026-10-10'),('00000000-0000-4000-8000-000000000002',null,'2026-10-10');`);
 const sql=await readFile(new URL('../supabase/migrations/202610140008_research_bill_balance.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 const balance=async()=>Number((await db.query<{amount_usd:string}>("select amount_usd from creator_shared_costs where provider like 'Perplexity%'")).rows[0].amount_usd);
 expect(await balance()).toBeCloseTo(1.34429,6);
 await db.exec(`update creator_research_usage set provider_cost_usd=.5 where id='00000000-0000-4000-8000-000000000002';`);
 expect(await balance()).toBeCloseTo(.84429,6);
 await db.exec(`create table creator_ai_generations(id uuid primary key,estimated_cost_usd numeric,created_at timestamptz);
 insert into creator_ai_generations values('00000000-0000-4000-8000-000000000004',5.1090477,'2026-10-10');`);
 const ai=await readFile(new URL('../supabase/migrations/202610140009_openai_bill_balance.sql',import.meta.url),'utf8');
 await db.exec(ai);await db.exec(ai);
 const aiBalance=async()=>Number((await db.query<{amount_usd:string}>("select amount_usd from creator_shared_costs where provider like 'OpenAI%' ")).rows[0].amount_usd);
 expect(await aiBalance()).toBeCloseTo(.2709523,7);
 await db.exec(`update creator_ai_generations set estimated_cost_usd=5.2;`);
 expect(await aiBalance()).toBeCloseTo(.18,7);
 await db.exec(`insert into creator_research_usage values('00000000-0000-4000-8000-000000000003',1,'2026-10-14');`);
 await db.exec(sql);
 expect(await balance()).toBeCloseTo(.84429,6);
 }finally{await db.close();}
},30000);
