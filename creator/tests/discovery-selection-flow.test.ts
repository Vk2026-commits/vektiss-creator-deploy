import {beforeAll,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({job:null as any,handler:null as any,run:vi.fn(),review:vi.fn(),start:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:(table:string)=>{
 let patch:any,filters:Array<[string,unknown]>=[];
 const result=()=>{
  if(['creator_research_sources','creator_research_opportunities'].includes(table))return {data:[],error:null};
  if(table==='creator_research_feedback')return {data:null,error:null};
  if(table==='creator_research_usage')return {data:null,error:null};
  if(table==='creator_provider_costs')return {data:null,error:null};
  const matches=filters.every(([k,v])=>k.startsWith('provider_metadata->>')?state.job.provider_metadata[k.split('->>')[1]]===v:state.job[k]===v);
  if(!matches)return {data:null,error:null};
  if(patch)state.job={...state.job,...structuredClone(patch)};
  return {data:structuredClone(state.job),error:null};
 };
 const q:any={select:()=>q,insert:()=>q,update:(p:any)=>{patch=p;return q;},upsert:()=>q,eq:(k:string,v:unknown)=>{filters.push([k,v]);return q;},order:()=>q,limit:()=>q,maybeSingle:async()=>result(),then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject)};return q;
}})}));
vi.mock('../supabase/functions/_shared/scrape-creators',async importOriginal=>({...await importOriginal<any>(),runSCTask:state.run}));
vi.mock('../supabase/functions/_shared/research-provider',async importOriginal=>({...await importOriginal<any>(),getDeepResearchRun:state.review,startNativeVideoScreening:state.start}));
import {discoveryFiltersSchema,collectEngagement} from '../src/domain/discovery-engagement';
const id='60254839-f89c-49a6-9620-54f49c779d58';
const brief={expertise:'',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Make Money With AI',primaryAudience:'AI businesses',audienceProblems:[],audienceInterests:[],contentPillars:[],sourceTopics:['AI services'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',discoveryPilot:true,discoveryFilters:discoveryFiltersSchema.parse({mode:'relevant',minViews:100000,minEngagementRate:2}),researchSourcePlatforms:['TikTok'],researchScreeningCriteria:'',researchSeekSituations:'',researchReferenceUrls:[],researchBlockedUrls:[],sourceMode:'videos'};
function deno(){vi.stubGlobal('Deno',{env:{get:()=> 'https://creator.vektiss.com'},serve:(fn:any)=>{state.handler=fn;}});}
beforeAll(async()=>{deno();await import('../supabase/functions/research-sync/index');});
beforeEach(()=>{deno();state.run.mockReset();state.review.mockReset();state.start.mockReset();state.job={id,user_id:'owner',content_profile_id:'profile',status:'researching',provider_response_id:id,requested_count:10,created_at:new Date(Date.now()-3600000).toISOString(),updated_at:new Date().toISOString(),input_snapshot:brief,provider_metadata:{selectionVersion:2,pilot:true,provider:'Scrape Creators',stage:'scrape_discovery_v2',scKnownIds:[],scPool:[],scTasks:[{id:'query',platform:'TikTok',kind:'search',query:'AI service'}],scLedger:[]}};});
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

it('does not let a late screening poll overwrite a newer evidence-review stage',async()=>{
 state.job.provider_metadata={stage:'multi_screening',selectionVersion:2,pilot:true,screeningStartedAt:new Date().toISOString(),nativeSources:[source],screeningRuns:[{id:'screening',sourceIds:[1]}],pendingScreeningBatches:[],scLedger:Array.from({length:40},(_,i)=>({id:String(i),status:200})),searchDiagnostics:{stopReason:'request_budget'}};
 state.review.mockImplementation(async()=>{state.job.provider_metadata.stage='pilot_relevance';return {id:'screening',status:'completed',sources:[source],candidates:[],decisions:[{sourceId:1,outcome:'needs_content_review',reason:'Caption unclear'}],usage:{},raw:{}};});await call();expect(state.job.provider_metadata.stage).toBe('pilot_relevance');
});

it('backs off a rate-limited next batch without treating the completed first batch as timed out',async()=>{
 state.job.provider_metadata={stage:'multi_screening',selectionVersion:2,pilot:true,screeningStartedAt:new Date(Date.now()-3600000).toISOString(),nativeSources:[source],screeningRuns:[{id:'screening',sourceIds:[1]}],pendingScreeningBatches:[[1]]};
 state.review.mockResolvedValue({id:'screening',status:'completed',sources:[source],candidates:[],decisions:[],usage:{},raw:{}});state.start.mockRejectedValue(Error('PROVIDER_HTTP_429'));
 await call();expect(state.job.status).toBe('researching');expect(state.job.provider_metadata.screeningQueueStartedAt).toBeTruthy();expect(state.job.provider_metadata.reviewLimited).toBeUndefined();expect(state.start).toHaveBeenCalledTimes(1);
 await call();expect(state.start).toHaveBeenCalledTimes(1);expect(state.review).toHaveBeenCalledTimes(1);
});

it('settles a completed article run with a 10-percent match as zero delivered ideas',async()=>{
 state.job.input_snapshot={...brief,sourceMode:'articles',articleWindow:{preset:'week',timezone:'UTC',start:'2026-10-14T00:00:00.000Z',end:'2026-10-21T00:00:00.000Z'}};
 state.job.provider_metadata={stage:'article_research',sourceMode:'articles'};
 state.review.mockResolvedValue({id,status:'completed',sources:[{...source,url:'https://example.com/article',sourceType:'article'}],candidates:[{title:'AI services',factualSummary:'A claimed client result.',whyAudienceCares:'Service business example.',creatorConnection:'AI expertise',recommendedAngle:'Check results',suggestedHook:'What worked?',category:'AI services',publishedAt:'2026-10-20',relevanceScore:10,timelinessScore:100,sourceIds:[1],uncertainty:''}],usage:{}});
 const response=await call();expect(response.status).toBe(200);expect(state.job.status).toBe('ready');expect(state.job.delivered_count).toBe(0);expect(state.job.reserved_count).toBe(0);expect(state.job.phase).toContain('No strong article matches');expect(state.job.provider_metadata.articleScreening.belowMinimum).toBe(1);
});
