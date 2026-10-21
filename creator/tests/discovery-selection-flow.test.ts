import {beforeAll,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({job:null as any,handler:null as any,run:vi.fn(),review:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:(table:string)=>{
 let patch:any,filters:Array<[string,unknown]>=[];
 const result=()=>{
  if(table==='creator_research_sources')return {data:[],error:null};
  if(table==='creator_provider_costs')return {data:null,error:null};
  const matches=filters.every(([k,v])=>k.startsWith('provider_metadata->>')?state.job.provider_metadata[k.split('->>')[1]]===v:state.job[k]===v);
  if(!matches)return {data:null,error:null};
  if(patch)state.job={...state.job,...structuredClone(patch)};
  return {data:structuredClone(state.job),error:null};
 };
 const q:any={select:()=>q,update:(p:any)=>{patch=p;return q;},upsert:()=>q,eq:(k:string,v:unknown)=>{filters.push([k,v]);return q;},order:()=>q,limit:()=>q,maybeSingle:async()=>result(),then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject)};return q;
}})}));
vi.mock('../supabase/functions/_shared/scrape-creators',async importOriginal=>({...await importOriginal<any>(),runSCTask:state.run}));
vi.mock('../supabase/functions/_shared/research-provider',async importOriginal=>({...await importOriginal<any>(),getDeepResearchRun:state.review}));
import {discoveryFiltersSchema,collectEngagement} from '../src/domain/discovery-engagement';
const id='60254839-f89c-49a6-9620-54f49c779d58';
const brief={expertise:'',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Make Money With AI',primaryAudience:'AI businesses',audienceProblems:[],audienceInterests:[],contentPillars:[],sourceTopics:['AI services'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',discoveryPilot:true,discoveryFilters:discoveryFiltersSchema.parse({mode:'relevant',minViews:100000,minEngagementRate:2}),researchSourcePlatforms:['TikTok'],researchScreeningCriteria:'',researchSeekSituations:'',researchReferenceUrls:[],researchBlockedUrls:[],sourceMode:'videos'};
function deno(){vi.stubGlobal('Deno',{env:{get:()=> 'https://creator.vektiss.com'},serve:(fn:any)=>{state.handler=fn;}});}
beforeAll(async()=>{deno();await import('../supabase/functions/research-sync/index');});
beforeEach(()=>{deno();state.run.mockReset();state.review.mockReset();state.job={id,user_id:'owner',content_profile_id:'profile',status:'researching',provider_response_id:id,requested_count:10,created_at:new Date(Date.now()-3600000).toISOString(),updated_at:new Date().toISOString(),input_snapshot:brief,provider_metadata:{selectionVersion:2,pilot:true,provider:'Scrape Creators',stage:'scrape_discovery_v2',scKnownIds:[],scPool:[],scTasks:[{id:'query',platform:'TikTok',kind:'search',query:'AI service'}],scLedger:[]}};});
const call=()=>state.handler(new Request('https://example.test/sync',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({jobId:id})}));
const source={providerSourceId:1,url:'https://www.tiktok.com/@expert/video/123456',title:'AI service demo',snippet:'A paying AI client',publishedAt:new Date().toISOString(),sourceType:'tiktok-native',engagement:collectEngagement({views:200000,likes:10000},'test')};
it('spends only the final remaining API slot and checkpoints the qualifying source',async()=>{
 state.job.provider_metadata.scLedger=Array.from({length:39},(_,i)=>({id:'old'+i,status:200,remaining:100,credits:1}));
 state.run.mockResolvedValue({sources:[source],ledger:{id:'query',route:'/search',status:200,credits:1,remaining:99}});
 await call();expect(state.run).toHaveBeenCalledTimes(1);expect(state.job.provider_metadata.scLedger).toHaveLength(40);
 await call();expect(state.run).toHaveBeenCalledTimes(1);expect(state.job.provider_metadata.additionalSources).toHaveLength(1);expect(state.job.provider_metadata.stage).toBe('multi_discovery');
});
it('does not resurrect a search cancelled while the provider request is in flight',async()=>{
 state.run.mockImplementation(async()=>{state.job.status='cancelled';return {sources:[source],ledger:{id:'query',status:200,credits:1,remaining:99}};});
 await call();expect(state.job.status).toBe('cancelled');await call();expect(state.run).toHaveBeenCalledTimes(1);
});
it('does not dispatch paid requests again while an earlier batch owns the checkpoint',async()=>{
 Object.assign(state.job,{status:'reviewing_sources'});Object.assign(state.job.provider_metadata,{scPhaseAt:new Date().toISOString(),scInFlight:['query']});await call();expect(state.run).not.toHaveBeenCalled();
});
it('measures the review deadline from screening rather than an hour-old search creation time',async()=>{
 state.job.provider_metadata={stage:'multi_screening',selectionVersion:2,pilot:true,screeningStartedAt:new Date(Date.now()-10000).toISOString(),nativeSources:[source],screeningRuns:[{id:'screening',sourceIds:[1]}],pendingScreeningBatches:[]};
 state.review.mockResolvedValue({id:'screening',status:'queued'});const response=await call();expect(response.status).toBe(202);expect(state.job.status).toBe('researching');expect(state.job.phase).toContain('Checking clip quality');
});
