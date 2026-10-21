import {expect,it,vi,afterEach} from 'vitest';
import {mergePool,shortlist,selectionDiagnostics,confirmedFailure} from '../supabase/functions/_shared/discovery-selection';
import {detailTasks,runSCTask,expansionTask,scrapeTasks,type SCTask} from '../supabase/functions/_shared/scrape-creators';
import {screeningDecisions,acceptedCandidates,inspectionIds,sourceTopicSupported} from '../src/domain/pilot-screening';
import {getDeepResearchRun,nativeScreeningInstructions,startNativeVideoScreening} from '../supabase/functions/_shared/research-provider';
import {discoveryFiltersSchema,collectEngagement} from '../src/domain/discovery-engagement';
import type {ResearchBrief,ResearchSource,ProviderResearchCandidate} from '../src/domain/research';
const brief={expertise:'',experience:'',industries:[],communicationStyle:'',creatorTone:[],phrasesToAvoid:[],preferredCtaStyle:'',creatorContext:'',audienceName:'Make Money With AI',primaryAudience:'AI service business owners',audienceProblems:[],audienceInterests:[],reactionAngles:[],desiredOutcomes:[],profileTone:[],thingsToAvoid:[],profileContext:'',discoveryPilot:true,sourceMode:'videos',researchSourcePlatforms:['TikTok','Instagram','YouTube'],sourceTopics:['AI services','first AI client','AI automation','AI side hustle experiment','AI freelancing income'],contentPillars:[],researchScreeningCriteria:'Find direct TikTok videos about AI services. Exclude unsupported overnight wealth.',researchSeekSituations:'',researchReferenceUrls:[],researchBlockedUrls:[],discoveryFilters:discoveryFiltersSchema.parse({platform:'all',mode:'relevant',minViews:100000,minEngagementRate:2,maxAgeDays:90})} as ResearchBrief;
const source=(id:number,views:number|null=200000):ResearchSource=>({providerSourceId:id,url:`https://www.tiktok.com/@expert/video/${id}`,title:'AI service paying customer demo',snippet:'Selling an AI automation service to a business',sourceType:'tiktok-native',publishedAt:new Date().toISOString(),engagement:collectEngagement({views,likes:views===null?null:views*.04},'test')});
const candidate=(id:number)=>({title:'AI service',factualSummary:'Speaker describes a paying client',whyAudienceCares:'Service delivery',creatorConnection:'AI business',recommendedAngle:'Explain customer value',category:'Services',publishedAt:null,timelinessScore:80,relevanceScore:85,sourceIds:[id],suggestedHook:'',uncertainty:''}) as ProviderResearchCandidate;
afterEach(()=>vi.unstubAllGlobals());
it('keeps qualifying videos beyond the eighth result and excludes known failures before the shortlist cap',()=>{
 const rows=Array.from({length:100},(_,i)=>source(i+1,i<70?1000:200000));const pool=mergePool([],rows,brief);const selected=shortlist(pool,brief);expect(selected).toHaveLength(30);expect(selected.every(s=>s.providerSourceId>70)).toBe(true);
});
it('duplicates do not crowd the bounded raw pool, and detail updates keep a single enriched record',()=>{
 const duplicate=source(1);let pool=mergePool([],Array.from({length:100},()=>duplicate),brief);pool=mergePool(pool,Array.from({length:300},(_,i)=>source(i+2)),brief);expect(pool).toHaveLength(250);expect(shortlist(pool,brief)).toHaveLength(40);
 const unknown={...source(999),publishedAt:null,engagement:collectEngagement({},'test')};pool=mergePool([unknown],[source(999)],brief);expect(pool).toHaveLength(1);expect(shortlist(pool,brief)).toHaveLength(1);
});
it('enriches missing data only when no known active requirement already fails',()=>{
 const yt=(s:ResearchSource)=>({...s,url:'https://www.youtube.com/watch?v=abcdefghij'+s.providerSourceId,sourceType:'youtube-shorts-native',publishedAt:null});
 const low=yt(source(1,100)),high=yt(source(2,200000));expect(confirmedFailure(low,brief)).toBe(true);expect(detailTasks([low,high],[],20,brief).map(t=>t.url)).toEqual([high.url]);expect(shortlist([high],brief)).toHaveLength(0);expect(shortlist([{...high,publishedAt:new Date().toISOString()}],brief)).toHaveLength(1);
});
it('reports unavailable dates/views separately from old dates and insufficient views',()=>{
 const rows=[{...source(1),publishedAt:null},{...source(2),publishedAt:'2020-01-01'},source(3,null),source(4,1000),source(5)];expect(selectionDiagnostics(rows,brief)).toMatchObject({passed:1,excluded:{date_unavailable:1,outside_date_range:1,views_unavailable:1,below_minimum_views:1}});
});
it('does not cap enrichment at ten and does not retry failed detail requests',()=>{
 const rows=Array.from({length:20},(_,i)=>({...source(i+1),url:'https://www.instagram.com/reel/code'+i,sourceType:'instagram-reels-native',publishedAt:null}));const tasks=detailTasks(rows,[],18,brief);expect(tasks).toHaveLength(18);expect(detailTasks(rows,tasks.map(t=>({...t,state:'failed'})),18,brief)).toHaveLength(2);
});
it('uses profile topics, selected platforms, and popularity sorting for an explicit high-view filter',async()=>{
 const tasks=scrapeTasks({...brief,researchSourcePlatforms:['TikTok']},'abc');expect(tasks).toHaveLength(5);expect(tasks.every(t=>t.query!.split(' ').length<=8)).toBe(true);
 vi.stubGlobal('Deno',{env:{get:()=> 'test'}});const fetcher=vi.fn(async()=>Response.json({success:true,credits_charged:1,search_item_list:Array.from({length:20},(_,i)=>({aweme_id:String(i+1),author:{unique_id:'expert'},desc:'AI service',statistics:{play_count:200000,digg_count:10000}})),cursor:12}));vi.stubGlobal('fetch',fetcher);
 const result=await runSCTask(tasks[0],brief);expect(result.sources).toHaveLength(20);expect(result.nextCursor).toBe('12');expect(new URL(String((fetcher.mock.calls[0] as unknown as [URL,RequestInit])[0])).searchParams.get('sort_by')).toBe('most-liked');
});
it('checkpoints platform pagination and stops repeated cursors instead of looping',()=>{
 const root:SCTask={id:'s',platform:'TikTok',kind:'search',query:'AI service',state:'done',nextCursor:'12'};const page=expansionTask([root])!;expect(page.cursor).toBe('12');expect(expansionTask([root,{...page,state:'done',nextCursor:'12'}])).toBeUndefined();
 const ig={...root,platform:'Instagram' as const,nextCursor:undefined};expect(expansionTask([ig])?.page).toBe(2);
});
it('keeps ambiguous captions out of recommendations but inside the five-inspection allowance',()=>{
 const rows=[source(1),source(2),source(3)];const decisions=screeningDecisions(rows,[candidate(1)],[{sourceId:1,outcome:'accepted',reason:'Concrete AI service demonstration'},{sourceId:2,outcome:'needs_content_review',reason:'Caption does not establish topic'},{sourceId:3,outcome:'rejected',reason:'Clearly unrelated'}]);expect(acceptedCandidates([candidate(1),candidate(2),candidate(3)],decisions).map(c=>c.sourceIds[0])).toEqual([1]);expect(inspectionIds([candidate(1)],decisions)).toEqual([1,2]);
 const many=screeningDecisions(Array.from({length:20},(_,i)=>source(i+1)),[]);expect(inspectionIds([],many)).toHaveLength(5);expect(acceptedCandidates([candidate(1)],many)).toHaveLength(0);
});
it('uses reviewed evidence to classify an ambiguous source without inventing relevance',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'test'}});vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'review',status:'completed',output_text:JSON.stringify({opportunities:[candidate(2)],screeningDecisions:[{sourceId:2,outcome:'accepted',reason:'Transcript demonstrates an AI customer workflow'}]})})));
 const result=await getDeepResearchRun('review',brief,[source(2)]);expect('decisions' in result&&result.decisions?.[0].outcome).toBe('accepted');
 expect(nativeScreeningInstructions(brief,10,10,[source(2)])).toContain('Source platform selection is controlled only by researchSourcePlatforms');
});
it('requests explicit pilot decisions with source IDs constrained to supplied clips',async()=>{
 vi.stubGlobal('Deno',{env:{get:()=> 'test'}});const fetcher=vi.fn(async()=>Response.json({id:'review',status:'queued'}));vi.stubGlobal('fetch',fetcher);await startNativeVideoScreening({brief,requestedCount:10,sources:[source(1)]});const body=JSON.parse(String((fetcher.mock.calls[0] as unknown as [unknown,RequestInit])[1].body));expect(body.response_format.json_schema.schema.required).toContain('screeningDecisions');expect(body.response_format.json_schema.schema.properties.screeningDecisions.items.properties.sourceId.enum).toEqual([1]);
});

it('preserves useful search metadata and recomputes engagement when a partial detail response changes views',()=>{
 const original={...source(999),engagement:collectEngagement({views:100000,likes:5000},'test')};
 const partial={...source(999),title:'TikTok public creator video',snippet:'',publishedAt:null,engagement:collectEngagement({views:1000000},'test')};
 const [merged]=mergePool([original],[partial],brief);expect(merged.publishedAt).toBe(original.publishedAt);expect(merged.snippet).toBe(original.snippet);expect(merged.engagement?.rate).toBe(0.5);expect(shortlist([merged],brief)).toHaveLength(0);
});

it('does not approve a candidate when the model omitted its explicit relevance decision',()=>{
 const decisions=screeningDecisions([source(1)],[candidate(1)],[]);expect(decisions[0].outcome).toBe('needs_content_review');expect(acceptedCandidates([candidate(1)],decisions)).toHaveLength(0);
});

it('does not turn a generic first-client story into an AI recommendation using an invented reaction angle',()=>{
 const generic={...source(1),title:'My first customer in Dubai',snippet:'A customer commissioned this handmade mandala. I placed 2500 nails by hand.'};
 const verdict=screeningDecisions([generic],[candidate(1)],[{sourceId:1,outcome:'accepted',reason:'Ricky could add AI marketing'}],brief);expect(verdict[0].outcome).toBe('needs_content_review');expect(acceptedCandidates([candidate(1)],verdict)).toHaveLength(0);
 expect(sourceTopicSupported({...generic,review:{level:'video_sampled',accessibility:'accessible',reviewedAt:new Date().toISOString(),timestamps:[1],transcript:'',claims:'',observations:'No AI tools are visible.',limitations:'',generationIds:[]}},brief)).toBe(false);
 expect(sourceTopicSupported({...generic,snippet:'I use ChatGPT to draft client proposals for my service business.'},brief)).toBe(true);
});
