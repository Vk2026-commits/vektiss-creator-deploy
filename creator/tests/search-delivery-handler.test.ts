import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({job:null as any,rows:[] as any[],run:null as any,handler:null as any}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
 auth:{getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}}})},
 from(table:string){let patch:any,filters:any[]=[];const q:any={
 select(){return q;},eq(k:string,v:unknown){filters.push([k,v]);return q;},gt(){return q;},lt(){return q;},order(){return q;},limit(){return q;},delete(){return q;},
 update(v:any){patch=v;return q;},insert(){return q;},upsert(){return q;},
 result(single=false){
  if(table==='creator_research_jobs'){
   const matches=filters.every(([k,v])=>state.job[k]===v);
   if(patch&&matches)Object.assign(state.job,patch);
   return {data:matches?(single?structuredClone(state.job):[structuredClone(state.job)]):null,error:null};
  }
  if(table==='creator_research_opportunities')return {data:structuredClone(state.rows),error:null};
  return {data:single?null:[],error:null};
 },maybeSingle(){return Promise.resolve(q.result(true));},then(resolve:any,reject:any){return Promise.resolve(q.result()).then(resolve,reject);}};return q;},
 async rpc(_name:string,args:any){
  for(const row of args.p_rows){if(state.rows.some(r=>r.normalized_title===row.normalized_title)||state.job.delivered_count>=state.job.requested_count)continue;state.rows.push({...row,status:'new'});state.job.delivered_count++;state.job.reserved_count--;}
  return {data:structuredClone(state.job),error:null};
 }
})}));
vi.mock('../supabase/functions/_shared/research-provider',()=>({getDeepResearchRun:async()=>state.run,startDeepResearch:vi.fn(),startNativeVideoScreening:vi.fn()}));
afterEach(()=>vi.unstubAllGlobals());
it('publishes four immediately, continues, and completes only after the fifth provider-approved clip',async()=>{
 const user='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002';
 vi.stubGlobal('Deno',{env:{get:(k:string)=>k==='APP_ORIGIN'?'https://creator.vektiss.com':'test'},serve:(h:any)=>{state.handler=h;}});
 vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Unexpected network request');}));
 const brief:any={expertise:'',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'AI',primaryAudience:'Owners',audienceProblems:[],audienceInterests:[],contentPillars:[],sourceTopics:['AI'],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',discoveryFilters:{platform:'all',mode:'relevant',minViews:0,minEngagementRate:0,maxAgeDays:0,outlierMultiple:3}};
 const titles=['Automating customer follow-ups','Designing websites for restaurants','Editing podcast clips for clients','Building a searchable document assistant','Creating product photography for shops'];
 const source=(n:number)=>({providerSourceId:n,url:`https://www.instagram.com/reel/test${n}/`,title:titles[n-1],snippet:'A specific business demonstration',publishedAt:null,sourceType:'video'});
 const candidate=(n:number)=>({title:titles[n-1],factualSummary:'A demonstrated business service.',whyAudienceCares:'Useful service for clients.',creatorConnection:'Explain the opportunity.',recommendedAngle:'Show the practical application.',suggestedHook:'How this works',category:titles[n-1],publishedAt:null,timelinessScore:80,relevanceScore:95,sourceIds:[n],uncertainty:''});
 state.rows=[];
 const metadata=(sources:any[])=>({stage:'multi_screening',selectionVersion:2,pilot:true,pilotReviewed:true,round:4,screeningRuns:[{id:'review',sourceIds:sources.map(s=>s.providerSourceId)}],nativeSources:sources,scPool:[source(5)],scScreenedUrls:[],scTasks:[],scLedger:Array.from({length:40},(_,i)=>({id:String(i),status:200,remaining:10})),screeningStartedAt:new Date().toISOString()});
 const first=[1,2,3,4];
 state.job={id,user_id:user,content_profile_id:user,incremental_delivery:true,status:'researching',requested_count:5,delivered_count:0,reserved_count:5,provider_response_id:'review',input_snapshot:brief,provider_metadata:metadata(first.map(source)),created_at:new Date().toISOString()};
 state.run={id:'review',status:'completed',sources:first.map(source),candidates:first.map(candidate),usage:{},raw:{}};
 await import('../supabase/functions/research-sync/index');
 const request=()=>new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({jobId:id})});
 const firstResponse=await state.handler(request());
 expect(firstResponse.status).toBe(202);
 expect(state.rows).toHaveLength(4);
 expect(state.job.status).toBe('researching');
 expect(state.job.delivered_count).toBe(4);
 state.job.provider_metadata=metadata([source(5)]);
 state.run={...state.run,sources:[source(5)],candidates:[candidate(5)]};
 const finalResponse=await state.handler(request());
 expect(finalResponse.status).toBe(200);
 expect(state.job.status).toBe('ready');
 expect(state.job.delivered_count).toBe(5);
 expect(state.rows).toHaveLength(5);
 expect(fetch).not.toHaveBeenCalled();
});
