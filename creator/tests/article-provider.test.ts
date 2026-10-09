import {it,expect,vi,afterEach} from 'vitest';
import {startDeepResearch,getDeepResearchRun,startNativeVideoScreening} from '../supabase/functions/_shared/research-provider';
import {researchBriefSchema} from '../src/domain/research';
import {resolveArticleWindow} from '../src/domain/research-window';
const brief=researchBriefSchema.parse({expertise:'Safety',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Steve',primaryAudience:'Women',audienceProblems:[],audienceInterests:[],contentPillars:[],sourceTopics:[],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',sourceMode:'articles',articleWindow:resolveArticleWindow({preset:'week',timezone:'UTC'},new Date('2026-10-06T18:00:00Z'))});
afterEach(()=>vi.unstubAllGlobals());
function mock(payload:unknown){vi.stubGlobal('Deno',{env:{get:()=> 'test'}});const fetcher=vi.fn(async()=>new Response(JSON.stringify(payload),{status:200}));vi.stubGlobal('fetch',fetcher);return fetcher;}
it('uses publication filters without social domain restrictions',async()=>{
 const fetcher=mock({id:'test',status:'queued'});await startDeepResearch({brief,requestedCount:10,candidateMultiplier:1});
 const body=JSON.parse((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].body as string);
 expect(body.tools[0].filters.search_after_date_filter).toBe('09/28/2026');
 expect(body.tools[0].filters.search_domain_filter).toBeUndefined();
 expect(body.input).toContain('Return fewer or zero');
});
it('accepts an empty article result without inventing sources',async()=>{
 mock({id:'test',status:'completed',output_text:JSON.stringify({opportunities:[]}),output:[]});
 const result=await getDeepResearchRun('test',brief);expect('candidates'in result&&result.candidates).toEqual([]);
});
it('propagates provider failures',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'test'}});vi.stubGlobal('fetch',async()=>new Response('{}',{status:503}));
 await expect(startDeepResearch({brief,requestedCount:10,candidateMultiplier:1})).rejects.toThrow();
});
it('bounds screening to requested results and concise explanations',async()=>{
 const fetcher=mock({id:'test',status:'queued'});
 const sources=Array.from({length:30},(_,i)=>({providerSourceId:i+1,title:'Credit report story',url:`https://www.tiktok.com/@credit/video/${i+100}`,snippet:'A consumer explains a credit reporting error.',publishedAt:null,sourceType:'tiktok-native'}));
 for(const requestedCount of [10,20,30]){
  await startNativeVideoScreening({brief:{...brief,sourceMode:'videos'},requestedCount,sources});
  const body=JSON.parse((fetcher.mock.calls.at(-1) as unknown as [string,RequestInit])[1].body as string);
  expect(body.response_format.json_schema.schema.properties.opportunities.maxItems).toBe(requestedCount);
  expect(body.response_format.json_schema.schema.properties.opportunities.items.properties.factualSummary.maxLength).toBe(240);
  expect(body.max_output_tokens).toBeGreaterThanOrEqual(requestedCount*400);
  expect(body.input).toContain('fewer when relevance is insufficient');
 }
});
