import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeSC,scrapeTasks,detailTasks,balancedSources,runSCTask,scrapeUnavailable,SC_REQUEST_LIMIT,type SCLedger} from '../supabase/functions/_shared/scrape-creators';
import type {ResearchBrief} from '../src/domain/research';
const brief={sourceTopics:['AI services'],researchSourcePlatforms:['TikTok','Instagram','YouTube'],discoveryFilters:{mode:'engaged',maxAgeDays:90}} as ResearchBrief;
const tt=(id:number)=>normalizeSC('TikTok',{aweme_id:String(id),desc:'AI paying client',author:{unique_id:'expert'},create_time:1792500000,statistics:{play_count:50000,digg_count:2000,comment_count:10},video:{duration:45000}})!;
afterEach(()=>vi.unstubAllGlobals());
it('uses safety profile searches instead of AI-income pilot defaults',()=>{
 const safety={...brief,discoveryPilot:true,sourceTopics:['Practical personal-safety demonstrations'],contentPillars:['situational awareness'],audienceInterests:['personal safety'],researchSeekSituations:'',researchScreeningCriteria:'',researchSearchQueries:[]} as ResearchBrief;
 const tasks=scrapeTasks(safety,'stephen');
 expect(tasks.length).toBeGreaterThan(0);
 expect(tasks.every(t=>! /AI|freelanc|income|client|revenue/i.test(t.query??''))).toBe(true);
 expect(tasks.some(t=>/confrontation|interven|safety|security/i.test(t.query??''))).toBe(true);
});
it('normalizes current platform response shapes and preserves unknown counters',()=>{
 expect(tt(123).durationSeconds).toBe(45);expect(tt(123).engagement?.views).toBe(50000);
 const yt=normalizeSC('YouTube',{id:'abcdefghijk',title:'My first AI client',viewCountInt:50000});expect(yt?.engagement?.likes).toBeNull();expect(yt?.publishedAt).toBeNull();
 const ig=normalizeSC('Instagram',{media:{code:'ABCD',caption:{text:'AI workflow'},user:{username:'expert'},taken_at:1792500000,ig_play_count:40000,like_count:1000}});expect(ig?.engagement?.rate).toBe(2.5);expect(ig?.creator?.identifier).toBe('expert');
 expect(normalizeSC('YouTube',{url:'https://youtube.com.evil.test/watch?v=abcdefghijk'})).toBeNull();
});
it('interleaves five lanes across requested platforms and bounds all followed creators',()=>{
 expect(scrapeTasks(brief,'a')).toHaveLength(15);expect(scrapeTasks(brief,'a').slice(0,3).map(t=>t.platform)).toEqual(['TikTok','Instagram','YouTube']);
 expect(scrapeTasks({...brief,researchSourcePlatforms:['YouTube']},'a').every(t=>t.platform==='YouTube')).toBe(true);
 const watch=Array.from({length:20},(_,i)=>({platform:'TikTok' as const,identifier:'expert'+i,url:'https://www.tiktok.com/@expert'+i,name:'Expert'}));expect(scrapeTasks(brief,'a',watch)).toHaveLength(35);expect(SC_REQUEST_LIMIT).toBe(40);
});
it('balances candidate limits across lanes instead of allowing the first query to fill the pool',()=>{
 const groups=Array.from({length:15},(_,i)=>({id:String(i),sources:Array.from({length:8},(_,j)=>tt(10000+i*100+j))}));
 const result=balancedSources(groups);expect(result).toHaveLength(40);for(let i=0;i<15;i++)expect(result.some(s=>s.url.endsWith('/'+(10000+i*100)))).toBe(true);
});
it('shares detail budget between Instagram and YouTube and never refetches completed details',()=>{
 const yt=Array.from({length:10},(_,i)=>normalizeSC('YouTube',{id:'abcdefghij'+i,title:'AI',viewCountInt:1000000})!);
 const ig=Array.from({length:10},(_,i)=>normalizeSC('Instagram',{code:'reel'+i,caption:'AI',like_count:100})!);
 const tasks=detailTasks([...yt,...ig],[],10);expect(tasks.filter(t=>t.platform==='YouTube')).toHaveLength(5);expect(tasks.filter(t=>t.platform==='Instagram')).toHaveLength(5);expect(detailTasks([...yt,...ig],tasks,10).some(t=>tasks.some(x=>x.url===t.url))).toBe(false);
});
it('uses server credentials, compatible Shorts search parameters, and actual credit reporting',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'server-test-key'}});const fetcher=vi.fn(async()=>Response.json({success:true,credits_charged:1,credits_remaining:96,shorts:[{id:'abcdefghijk',title:'AI',viewCountInt:50000}]}));vi.stubGlobal('fetch',fetcher);
 const r=await runSCTask({id:'s',platform:'YouTube',kind:'search',query:'AI side hustle'},brief);expect(r.sources).toHaveLength(1);expect(r.ledger.credits).toBe(1);expect(r.ledger.remaining).toBe(96);const [url,options]=fetcher.mock.calls[0] as unknown as [URL,RequestInit];expect(url.hostname).toBe('api.scrapecreators.com');expect(url.searchParams.get('sortBy')).toBe('relevance');expect(url.searchParams.get('type')).toBe('shorts');expect(options.headers).toEqual({'x-api-key':'server-test-key'});
});
it('does not retry or invent counters on failure, credit exhaustion, or authentication errors',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'test'}});const fetcher=vi.fn(async()=>Response.json({success:false},{status:402}));vi.stubGlobal('fetch',fetcher);const r=await runSCTask({id:'s',platform:'TikTok',kind:'search',query:'AI'},brief);expect(r.sources).toHaveLength(0);expect(r.ledger.credits).toBeNull();expect(fetcher).toHaveBeenCalledTimes(1);expect(scrapeUnavailable([r.ledger])).toBe(true);expect(scrapeUnavailable([{status:200,remaining:0} as SCLedger])).toBe(true);
});
it('only invokes the replacement for the pilot and persists paid-call claims before launching',()=>{
 const request=readFileSync('supabase/functions/research-request/index.ts','utf8'),sync=readFileSync('supabase/functions/research-sync/index.ts','utf8');expect(request).toContain('brief.discoveryPilot&&scrapeEnabled()');expect(sync).toContain('scPhaseAt');expect(sync).toContain('Interrupted Scrape Creators requests were not automatically retried');expect(sync).toContain("eq('provider_metadata->>scPhaseAt',phaseAt)");expect(sync).toContain('baselineClaimAt');
});
