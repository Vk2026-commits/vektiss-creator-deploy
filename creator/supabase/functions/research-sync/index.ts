import {ARTICLE_NEWS_DOMAINS} from '../../../src/domain/article-policy.ts';
import {qualifyArticleCandidates} from '../../../src/domain/article-screening.ts';
import {screeningDecisions,acceptedCandidates,inspectionIds,type ScreeningDecision} from '../../../src/domain/pilot-screening.ts';
import {mergePool,shortlist,selectionDiagnostics,selectionReason} from '../_shared/discovery-selection.ts';
import {runSCTask,detailTasks,balancedSources,expansionTask,scrapeUnavailable,SC_REQUEST_LIMIT,type SCGroup,type SCTask,type SCLedger} from '../_shared/scrape-creators.ts';
import {engagementFailure,sourceCreator,creatorKey,attachBaseline} from '../../../src/domain/discovery-engagement.ts';
import type {CreatorSource} from '../../../src/domain/discovery-pilot.ts';
import {startWatchlistDiscovery} from '../_shared/platform-discovery.ts';
import {inspectPilot,mergePilotEvidence} from '../_shared/discovery-inspection.ts';
import {dedupeVideos,INSPECTION_LIMIT,canonicalVideo,videoIdentity} from '../../../src/domain/discovery-pilot.ts';
import {providerText} from '../../../src/domain/provider-text.ts';
import {reviewWaitExpired} from '../../../src/domain/review-wait.ts';
import { createClient } from "@supabase/supabase-js";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import { getDeepResearchRun, startDeepResearch, startNativeVideoScreening, type CompletedResearchRun, type ProviderRun } from "../_shared/research-provider.ts";
import { buildCrossPlatformQueryPack, discoveryDiagnostics, getNativeDiscoveryRun, renumberNativeSources, type NativeDiscoveryResult, type NativePlatform } from "../_shared/platform-discovery.ts";
import {completedSearchPhase,filteredSearchPhase} from '../../../src/domain/search-phase.ts';
import {mergeSearchRound} from '../../../src/domain/search-rounds.ts';
import {
  canonicalResearchUrl,
  providerResearchCandidateSchema,
  rankResearchCandidates,
  selectDiverseVideoCandidates,
  researchBriefSchema,
  researchSourceSchema,
  type ResearchHistorySignal,
  type ProviderResearchCandidate,
  type ResearchSource,
} from "../../../src/domain/research.ts";
import { z } from "zod";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const requestSchema = z.object({ jobId: z.string().uuid(), action:z.enum(['sync','stop']).default('sync') }).strict();

function headersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json", "cache-control": "no-store", vary: "Origin",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
  };
  if (origin) headers["access-control-allow-origin"] = origin;
  return headers;
}
function reply(headers: Record<string, string>, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
function providerCost(usage: Record<string, unknown>): number | null {
  const cost = usage.cost;
  if (!cost || typeof cost !== "object") return null;
  const value = (cost as Record<string, unknown>).total_cost;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
async function markFailed(job: Record<string, unknown>, code: string, cancelled = false, diagnostics: {incompleteReason?:string;usage?:Record<string,unknown>;model?:string} = {}) {
  if (["ready", "failed", "cancelled"].includes(String(job.status))) return;
  await db.from("creator_research_jobs").update({
    status: cancelled ? "cancelled" : "failed", reserved_count:0, phase: cancelled ? "Research cancelled" : "Research unavailable", error_code: code,
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", job.id);

  await db.from("creator_research_usage").insert({
    id: crypto.randomUUID(), job_id: job.id, user_id: job.user_id, operation: "deep_research_failed",
    provider_response_id: job.provider_response_id ?? null, status: cancelled ? "cancelled" : "failed",
    model:diagnostics.model, usage:diagnostics.usage ?? {}, provider_cost_usd:providerCost(diagnostics.usage ?? {}),
    request_metadata: { code, incompleteReason:diagnostics.incompleteReason },
  });
}

function metadata(job: Record<string, unknown>): Record<string, unknown> {
  const value = job.provider_metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nativeSources(value: unknown): ResearchSource[] {
  const parsed = z.array(researchSourceSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function retainedCandidates(value: unknown): ProviderResearchCandidate[] {
  const parsed = z.array(providerResearchCandidateSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function roundNumber(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? Math.max(1, Math.min(3, value)) : 1;
}

function sourcePlatform(source: ResearchSource): NativePlatform {
  const host = new URL(source.url).hostname;
  return host.endsWith("instagram.com") ? "Instagram" : host.endsWith("youtube.com") || host === "youtu.be" ? "YouTube" : "TikTok";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  let job: Record<string, unknown> | null = null;
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return reply(headers, { code: "AUTH" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
    const input = requestSchema.parse(await request.json());
    const loaded = await db.from("creator_research_jobs").select("*").eq("id", input.jobId).eq("user_id", auth.user.id).maybeSingle();
    if (loaded.error || !loaded.data) return reply(headers, { code: "JOB" }, 404);
    job = loaded.data as Record<string, unknown>;
    if(input.action==='stop'){
      const stopped=await db.rpc('creator_research_stop',{p_job_id:input.jobId,p_user_id:auth.user.id});
      if(stopped.error)return reply(headers,{code:'STOP_FAILED'},503);
      return reply(headers,{job:stopped.data});
    }
    if (["ready", "failed", "cancelled"].includes(String(job.status))) return reply(headers, { job });
    if (!job.provider_response_id) {
      if(job.status==='queued')return reply(headers,{job},202);
      await markFailed(job, "PROVIDER_RESPONSE_MISSING");
      return reply(headers, { code: "PROVIDER_RESPONSE_MISSING" }, 503);
    }

    const brief = researchBriefSchema.safeParse(job.input_snapshot);
    if (!brief.success) throw new Error("RESEARCH_INPUT");
    const providerMetadata = metadata(job);
    if(providerMetadata.stage==='scrape_discovery_v2'){
      const tasks=(providerMetadata.scTasks??[]) as SCTask[],ledger=(providerMetadata.scLedger??[]) as SCLedger[];
      let pool=nativeSources(providerMetadata.scPool);
      const screened=(providerMetadata.scScreenedUrls??[]) as string[];
      if(job.status==='reviewing_sources'){
        if(Date.now()-Date.parse(String(providerMetadata.scPhaseAt))<60000)return reply(headers,{job},202);
        const inFlight=new Set(providerMetadata.scInFlight as string[]??[]);
        const next={...providerMetadata,scTasks:tasks.map(t=>inFlight.has(t.id)?{...t,state:'failed'}:t),scLedger:[...ledger,...tasks.filter(t=>inFlight.has(t.id)).map(t=>({id:t.id,route:'interrupted-request',status:0,credits:null,remaining:null,at:String(providerMetadata.scPhaseAt)}))],scInFlight:[],providerDiagnostics:[...providerMetadata.providerDiagnostics as string[]??[],'Interrupted requests were not retried; charge unknown.']};
        const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:next,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>scPhaseAt',String(providerMetadata.scPhaseAt)).select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE_SC_RECOVERY');return reply(headers,{job:saved.data??job},202);
      }
      if(!providerMetadata.scKnownIds){
        const known=await db.from('creator_research_sources').select('canonical_url').eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(1000);if(known.error)throw Error('SOURCE_LOOKUP');
        providerMetadata.scKnownIds=(known.data??[]).map(s=>videoIdentity(s.canonical_url));
      }
      const knownIds=new Set(providerMetadata.scKnownIds as Array<string|null>);
      pool=pool.filter(s=>!knownIds.has(videoIdentity(s.url)));
      const remaining=40-ledger.length-(brief.data.discoveryFilters?.mode==='outliers'&&!providerMetadata.baselineRuns?5:0);
      let pending=tasks.filter(t=>!t.state);
      const target=Math.min(40-screened.length,Math.max(Number(job.requested_count)*2,10));
      const eligible=shortlist(pool,brief.data,[...screened,...providerMetadata.scFilterRejectedUrls as string[]??[]],Math.max(0,40-screened.length));
      if(!pending.length&&remaining>0&&!scrapeUnavailable(ledger)&&eligible.length<target){
        const details=detailTasks(pool.filter(s=>!screened.includes(s.url)),tasks,Math.min(3,remaining),brief.data);
        const expansion=expansionTask(tasks);
        const lastWasDetail=ledger.length>0&&tasks.find(t=>t.id===ledger[ledger.length-1].id)?.kind==='detail';
        pending=details.length&&(!lastWasDetail||!expansion)?details:expansion?[expansion]:details;
        tasks.push(...pending);
      }
      if(!pending.length||remaining<=0||scrapeUnavailable(ledger)||screened.length>=40){
        await db.from('creator_provider_costs').upsert({provider:'Scrape Creators',external_id:String(job.id),user_id:job.user_id,job_id:job.id,operation:'Discovery (credits in diagnostics)',status:scrapeUnavailable(ledger)?'LIMITED':'COMPLETED',cost_usd:null},{onConflict:'provider,external_id'});
        const next={...providerMetadata,stage:'multi_discovery',scPool:pool,scTasks:tasks,additionalSources:eligible,discoveryRuns:[],searchDiagnostics:{provider:'Scrape Creators',requests:ledger.length,credits:ledger.reduce((n,l)=>n+(l.credits??0),0),creditsRemaining:Math.min(...ledger.flatMap(l=>l.remaining===null?[]:[l.remaining])),unreportedCharges:ledger.filter(l=>l.credits===null).length,requestLimit:40,rawReturned:providerMetadata.scRawReturned??0,uniqueRetained:pool.length,stopReason:eligible.length>=target?'shortlist_ready':remaining<=0?'request_budget':scrapeUnavailable(ledger)?'provider_limited':'no_more_results'},engagementDiagnostics:selectionDiagnostics(pool,brief.data)};
        const saved=await db.from('creator_research_jobs').update({provider_metadata:next,phase:`${eligible.length} qualifying clips ready for relevance review`,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching').eq('provider_metadata->>stage','scrape_discovery_v2').select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE_SC_SHORTLIST');return reply(headers,{job:saved.data??job},202);
      }
      const batch=pending.slice(0,Math.min(3,remaining)),phaseAt=new Date().toISOString();
      const claimed=await db.from('creator_research_jobs').update({status:'reviewing_sources',provider_metadata:{...providerMetadata,scTasks:tasks,scInFlight:batch.map(t=>t.id),scPhaseAt:phaseAt},phase:batch[0].kind==='detail'?'Checking missing dates and engagement…':'Finding clips that match your requirements…',updated_at:phaseAt}).eq('id',job.id).eq('status','researching').select('id').maybeSingle();if(claimed.error)throw Error('PERSISTENCE_SC_CLAIM');if(!claimed.data)return reply(headers,{job},202);
      const results=await Promise.all(batch.map(t=>runSCTask(t,brief.data)));
      for(const result of results)pool=mergePool(pool,result.sources.filter(s=>!knownIds.has(videoIdentity(s.url))),brief.data);
      const byId=new Map(batch.map((t,i)=>[t.id,results[i]]));
      const next={...providerMetadata,scTasks:tasks.map(t=>byId.has(t.id)?{...t,state:byId.get(t.id)!.diagnostic?'failed':'done',nextCursor:byId.get(t.id)!.nextCursor}:t),scPool:pool,scLedger:[...ledger,...results.map(r=>r.ledger)],scRawReturned:Number(providerMetadata.scRawReturned??0)+results.reduce((n,r)=>n+(r.ledger.id.startsWith('detail-')?0:r.sources.length),0),scInFlight:[],providerDiagnostics:[...providerMetadata.providerDiagnostics as string[]??[],...results.flatMap(r=>r.diagnostic?[r.diagnostic]:[])]};
      const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:next,phase:`${pool.length} unique clips checked; selecting qualifying matches`,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>scPhaseAt',phaseAt).select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE_SC_RESULTS');return reply(headers,{job:saved.data??job},202);
    }
    if(providerMetadata.stage==='scrape_discovery'){
      const tasks=(Array.isArray(providerMetadata.scTasks)?providerMetadata.scTasks:[]) as SCTask[];
      const ledger=(Array.isArray(providerMetadata.scLedger)?providerMetadata.scLedger:[]) as SCLedger[];
      const sources=nativeSources(providerMetadata.scSources);
      const groups=(Array.isArray(providerMetadata.scGroups)?providerMetadata.scGroups:[]) as SCGroup[];
      if(job.status==='reviewing_sources'){
        if(Date.now()-Date.parse(String(providerMetadata.scPhaseAt))<60000)return reply(headers,{job},202);
        const abandoned=new Set(Array.isArray(providerMetadata.scInFlight)?providerMetadata.scInFlight as string[]:[]);
        const recovered=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:{...providerMetadata,scTasks:tasks.map(t=>abandoned.has(t.id)?{...t,state:'failed'}:t),scLedger:[...ledger,...tasks.filter(t=>abandoned.has(t.id)).map(t=>({id:t.id,route:'interrupted-request',status:0,credits:null,remaining:null,at:String(providerMetadata.scPhaseAt)}))],scInFlight:[],providerDiagnostics:[...(providerMetadata.providerDiagnostics as string[]??[]),'Interrupted Scrape Creators requests were not automatically retried; credit charge unknown.']},updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>scPhaseAt',String(providerMetadata.scPhaseAt)).select('*').maybeSingle();if(recovered.error)throw Error('PERSISTENCE');return reply(headers,{job:recovered.data??job},202);
      }
      const remaining=ledger.map(l=>l.remaining).filter((n):n is number=>typeof n==='number');
      let pending=tasks.filter(t=>!t.state);
      if(scrapeUnavailable(ledger)){pending=[];providerMetadata.providerDiagnostics=[...(providerMetadata.providerDiagnostics as string[]??[]),'Scrape Creators authentication or credits unavailable; no Apify fallback or purchase was made.'];}
      if(!pending.length&&!providerMetadata.scHydrated&&!scrapeUnavailable(ledger)){
        const details=detailTasks(sources,tasks,35-ledger.length);providerMetadata.scHydrated=true;
        if(details.length){providerMetadata.scTasks=[...tasks,...details];const saved=await db.from('creator_research_jobs').update({provider_metadata:providerMetadata,phase:'Fetching current engagement counts for shortlisted search results…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching').select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE');return reply(headers,{job:saved.data??job},202);}
      }
      if(!pending.length){
        await db.from('creator_provider_costs').upsert({provider:'Scrape Creators',external_id:String(job.id),user_id:job.user_id,job_id:job.id,operation:'Discovery (credits recorded in search diagnostics)',status:scrapeUnavailable(ledger)?'LIMITED':'COMPLETED',cost_usd:null},{onConflict:'provider,external_id'});
        const next={...providerMetadata,stage:'multi_discovery',scGroups:undefined,scSources:undefined,additionalSources:sources,discoveryRuns:[],searchDiagnostics:{provider:'Scrape Creators',requests:ledger.length,credits:ledger.reduce((n,l)=>n+(l.credits??0),0),unreportedCharges:ledger.filter(l=>l.credits===null).length,creditsRemaining:remaining.length?Math.min(...remaining):null,requestLimit:SC_REQUEST_LIMIT}};
        const saved=await db.from('creator_research_jobs').update({provider_metadata:next,phase:'Screening clips from Scrape Creators…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching').select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE');return reply(headers,{job:saved.data??job},202);
      }
      const batch=pending.slice(0,Math.max(0,Math.min(3,35-ledger.length)));
      if(!batch.length)throw Error('SCRAPECREATORS_REQUEST_LIMIT');
      const phaseAt=new Date().toISOString();
      const claimed=await db.from('creator_research_jobs').update({status:'reviewing_sources',provider_metadata:{...providerMetadata,scInFlight:batch.map(t=>t.id),scPhaseAt:phaseAt},phase:'Searching Scrape Creators for public clips…',updated_at:phaseAt}).eq('id',job.id).eq('status','researching').select('id').maybeSingle();if(claimed.error)throw Error('PERSISTENCE');if(!claimed.data)return reply(headers,{job},202);
      const results=await Promise.all(batch.map(task=>runSCTask(task,brief.data)));
      for(let i=0;i<batch.length;i++){const result=results[i];if(batch[i].kind==='detail'){const incoming=new Map(result.sources.map(s=>[videoIdentity(s.url),s]));for(const group of groups)group.sources=group.sources.map(s=>incoming.get(videoIdentity(s.url))??s);}else groups.push({id:batch[i].id,sources:result.sources});}
      const merged=balancedSources(groups);
      const byId=new Map(batch.map((task,i)=>[task.id,results[i]]));
      const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:{...providerMetadata,scTasks:tasks.map(task=>byId.has(task.id)?{...task,state:byId.get(task.id)!.diagnostic?'failed':'done'}:task),scGroups:groups,scSources:merged,scLedger:[...ledger,...results.map(r=>r.ledger)],scInFlight:[],providerDiagnostics:[...(providerMetadata.providerDiagnostics as string[]??[]),...results.flatMap(r=>r.diagnostic?[r.diagnostic]:[])]},phase:`Scrape Creators: ${merged.length} unique clips collected`,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>scPhaseAt',phaseAt).select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE');return reply(headers,{job:saved.data??job},202);
    }
    if(job.status==='reviewing_sources'&&providerMetadata.provider==='Scrape Creators'&&providerMetadata.baselineClaimAt){
      if(Date.now()-Date.parse(String(providerMetadata.baselineClaimAt))<60000)return reply(headers,{job},202);
      const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:{...providerMetadata,baselineRuns:[],baselineStartedAt:new Date().toISOString(),baselineLaunchDiagnostics:['Interrupted creator-baseline requests were not retried. Charges and outlier baseline unavailable.']},updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>baselineClaimAt',String(providerMetadata.baselineClaimAt)).select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE');return reply(headers,{job:saved.data??job},202);
    }
    let inspectionRun:CompletedResearchRun|undefined;
    if(providerMetadata.stage==='pilot_relevance_starting'){
      if(Date.now()-Date.parse(String(providerMetadata.postReviewStartedAt))<60000)return reply(headers,{job},202);
      providerMetadata.stage='pilot_relevance';providerMetadata.relevanceReviewLimited=true;
      const recovered=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:providerMetadata,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').select('*').maybeSingle();if(recovered.error)throw Error('POST_REVIEW_RECOVERY');if(!recovered.data)return reply(headers,{job},202);
    }
    if(providerMetadata.stage==='pilot_relevance'){
      const all=nativeSources(providerMetadata.inspectionAllSources),ids=new Set(providerMetadata.postReviewSourceIds as number[]??[]);
      const checked=providerMetadata.postReviewRunId?await getDeepResearchRun(String(providerMetadata.postReviewRunId),brief.data,all.filter(s=>ids.has(s.providerSourceId))):{status:'failed'};
      if(checked.status!=='completed'){
        if(['queued','in_progress'].includes(checked.status)&&!reviewWaitExpired(providerMetadata.postReviewStartedAt))return reply(headers,{job},202);
        providerMetadata.relevanceReviewLimited=true;
      }
      const original=retainedCandidates(providerMetadata.inspectionCandidates).filter(c=>!ids.has(c.sourceIds[0]));
      const complete='candidates' in checked?checked as CompletedResearchRun:undefined;
      const decisions=complete?screeningDecisions(complete.sources,complete.candidates,complete.decisions,brief.data):[];
      inspectionRun={id:String(job.provider_response_id),status:'completed',sources:all,candidates:[...original,...(complete?acceptedCandidates(complete.candidates,decisions):[])],raw:{},usage:{cost:{total_cost:Number(providerCost(providerMetadata.inspectionUsage as Record<string,unknown>??{})??0)+Number(complete?providerCost(complete.usage)??0:0)}}};
      providerMetadata.pilotReviewed=true;providerMetadata.relevanceDecisions=decisions;
      providerMetadata.engagementDiagnostics={...providerMetadata.engagementDiagnostics as Record<string,unknown>,contentReviewAccepted:decisions.filter(d=>d.outcome==='accepted').length,contentReviewRejected:decisions.filter(d=>d.outcome==='rejected').length,contentReviewUnresolved:decisions.filter(d=>d.outcome==='needs_content_review').length};
    }
    if(providerMetadata.stage==='pilot_inspection'){
      if(Date.parse(String(providerMetadata.postReviewRetryAt))>Date.now())return reply(headers,{job},202);
      let check;try{check=await inspectPilot(String(job.id),request.headers.get('authorization')!);}catch{check={state:'failed' as const,reason:'Media inspection unavailable; watch original.'};}
      if(check.state==='pending'&&Date.now()-Date.parse(String(providerMetadata.inspectionStartedAt))<30*60*1000)return reply(headers,{job},202);
      const results=check.state==='completed'?check.results:[];
      const merged=mergePilotEvidence(nativeSources(providerMetadata.inspectionAllSources),retainedCandidates(providerMetadata.inspectionCandidates),results);
      if(providerMetadata.selectionVersion===2){
        const reviewable=merged.sources.filter(s=>results.some(r=>r.providerSourceId===s.providerSourceId&&r.review.level!=='metadata_only'));
        if(reviewable.length){
          const reviewAt=new Date().toISOString();
          const claim=await db.from('creator_research_jobs').update({status:'reviewing_sources',provider_metadata:{...providerMetadata,stage:'pilot_relevance_starting',postReviewStartedAt:reviewAt,postReviewSourceIds:reviewable.map(s=>s.providerSourceId),inspectionAllSources:merged.sources,inspectionCandidates:merged.candidates},updated_at:reviewAt}).eq('id',job.id).eq('status','researching').select('id').maybeSingle();if(claim.error)throw Error('POST_REVIEW_CLAIM');if(!claim.data)return reply(headers,{job},202);
          let review:ProviderRun;
          try{review=await startNativeVideoScreening({brief:brief.data,requestedCount:Number(job.requested_count),sources:reviewable});}
          catch(error){
            if(error instanceof Error&&error.message==='PROVIDER_HTTP_429'){
              const queueStart=providerMetadata.postReviewQueueStartedAt??new Date().toISOString();
              const next={...providerMetadata,stage:'pilot_inspection',postReviewQueueStartedAt:queueStart,postReviewRetryAt:new Date(Date.now()+30000).toISOString()};
              if(reviewWaitExpired(queueStart)){next.stage='pilot_relevance';Object.assign(next,{postReviewRunId:undefined,postReviewSourceIds:reviewable.map(s=>s.providerSourceId),inspectionAllSources:merged.sources,inspectionCandidates:merged.candidates,relevanceReviewLimited:true});}
              const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:next,phase:'Relevance provider is rate limited; waiting to continue…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>postReviewStartedAt',reviewAt).select('*').maybeSingle();if(saved.error)throw Error('POST_REVIEW_BACKOFF');return reply(headers,{job:saved.data??job},202);
            }
            throw error;
          }
          const next={...providerMetadata,stage:'pilot_relevance',postReviewRunId:review.id,postReviewSourceIds:reviewable.map(s=>s.providerSourceId),postReviewStartedAt:new Date().toISOString(),inspectionAllSources:merged.sources,inspectionCandidates:merged.candidates,reviewDiagnostics:check.state==='completed'?{inspected:check.inspectedCount,elapsedMs:check.elapsedMs,videoSampled:results.filter(r=>r.review.level==='video_sampled').length,transcriptReviewed:results.filter(r=>r.review.transcript).length,generationIds:results.flatMap(r=>r.review.generationIds)}:{inspected:0}};
          const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:next,phase:'Checking audience relevance against reviewed content…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>postReviewStartedAt',reviewAt).select('*').maybeSingle();if(saved.error)throw Error('POST_REVIEW_SAVE');return reply(headers,{job:saved.data??job},202);
        }
      }
      inspectionRun={id:String(job.provider_response_id),status:'completed',...merged,raw:{},usage:providerMetadata.inspectionUsage as Record<string,unknown>??{}};
      providerMetadata.pilotReviewed=true;providerMetadata.reviewDiagnostics=check.state==='completed'?{inspected:check.inspectedCount,elapsedMs:check.elapsedMs,transcriptReviewed:check.results.filter(r=>r.review.transcript).length,videoSampled:check.results.filter(r=>r.review.level==='video_sampled').length,generationIds:check.results.flatMap(r=>r.review.generationIds)}: {inspected:0,reason:check.state==='failed'?check.reason:'Media review deadline exceeded'};
      const kept=await db.from('creator_research_jobs').update({provider_metadata:providerMetadata,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching');if(kept.error)throw Error('PERSISTENCE');
    }
    const currentRound = roundNumber(providerMetadata.round);
    if (providerMetadata.stage === "native_discovery" || providerMetadata.stage === "multi_discovery") {
      if (job.status !== "researching") return reply(headers, { job }, 202);
      const multi = providerMetadata.stage === "multi_discovery";
      const runs = multi && Array.isArray(providerMetadata.discoveryRuns) ? providerMetadata.discoveryRuns as Array<Record<string, unknown>> : [];
      const checkedRuns = multi ? await Promise.all(runs.map(async (run) => {
        if (run.state === "completed" || run.state === "failed") return run;
        const platform: NativePlatform = run.platform === "YouTube" || run.platform === "Instagram" ? run.platform : "TikTok";
        try {
          const result = await getNativeDiscoveryRun(String(run.id), Number(job!.requested_count), brief.data, platform);
          return { ...run, ...result, sources: result.state === "completed" ? result.sources.filter(source=>!run.watchlist||!source.publishedAt||Date.parse(source.publishedAt)>=Date.now()-90*86400000).map((source) => ({ ...source, snippet: providerText(source.snippet,1200) })) : [] };
        } catch { return { ...run, state: "failed", status: "PROVIDER_ERROR", sources: [] }; }
      })) : [];
      const sourceGroups = checkedRuns.map((run) => run.state === "completed" && Array.isArray(run.sources) ? nativeSources(run.sources) : []);
      if(providerMetadata.pilot)sourceGroups.push(nativeSources(providerMetadata.additionalSources));
      const balancedSources = Array.from({ length: Math.max(0, ...sourceGroups.map((group) => group.length)) }, (_, index) =>
        sourceGroups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
      const discovery: NativeDiscoveryResult = multi
        ? checkedRuns.some((run) => run.state === "pending")
          ? { state: "pending", status: "MULTI" }
          : { state: "completed", status: "MULTI", sources: balancedSources }
        : await getNativeDiscoveryRun(String(job.provider_response_id), Number(job.requested_count), brief.data);
      const costRuns = multi ? checkedRuns : [{ id: job.provider_response_id, platform: 'TikTok', ...discovery }];
      for (const run of costRuns) {
        if (typeof run.costUsd !== 'number') continue;
        const { error: costError } = await db.from('creator_provider_costs').upsert({
          provider: 'Apify', external_id: String(run.id), user_id: job.user_id, job_id: job.id,
          operation: `${String(run.platform)} discovery`, status: String(run.status), cost_usd: run.costUsd,
        }, { onConflict: 'provider,external_id' });
        if (costError) console.error('PROVIDER_COST_RECORD_FAILED', costError.code);
      }
      if (discovery.state === "pending") {
        const updated = await db.from("creator_research_jobs").update({
          status: "researching", phase: multi && currentRound > 1
            ? `${Number(providerMetadata.acceptedCountSoFar ?? 0)} of ${job.requested_count} strong clips found; searching round ${currentRound} of 3…`
            : multi ? "Finding direct social videos…" : "Finding direct TikTok videos…",
          provider_metadata: { ...providerMetadata, apifyStatus: discovery.status, ...(multi ? { discoveryRuns: checkedRuns } : {}) }, updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
        return reply(headers, { job: updated.data ?? job }, 202);
      }
      if (discovery.state === "failed") {
        await markFailed(job, `APIFY_${discovery.status}`);
        return reply(headers, { code: `APIFY_${discovery.status}` }, 503);
      }
      const priorSources = nativeSources(providerMetadata.accumulatedSources);
      const priorCandidates = retainedCandidates(providerMetadata.accumulatedCandidates);
      const uniqueSources = providerMetadata.pilot ? dedupeVideos(discovery.sources).map(source=>({...source,url:canonicalVideo(source.url)!})) : [...new Map(discovery.sources.map(source=>[canonicalResearchUrl(source.url),source])).values()].slice(0,Math.min(90,Math.max(45,Number(job.requested_count)*7)));
      const discoveredUrls = uniqueSources
        .map((source) => canonicalResearchUrl(source.url))
        .filter((url): url is string => Boolean(url));
      // A 90-link discovery round can exceed PostgREST's URL limit when all
      // canonical URLs are placed in one `in` filter. Query bounded groups so
      // a later round cannot fail after earlier provider work has completed.
      const knownUrls = new Set<string>();
      for (let offset = 0; offset < discoveredUrls.length; offset += 12) {
        const known = await db.from("creator_research_sources").select("canonical_url")
          .eq("user_id", auth.user.id).in("canonical_url", discoveredUrls.slice(offset, offset + 12));
        if (known.error) throw new Error(`SOURCE_LOOKUP: ${known.error.code ?? "UNKNOWN"}`);
        for (const source of known.data ?? []) knownUrls.add(String(source.canonical_url));
      }
      const knownIdentities=new Set<string>();
      if(providerMetadata.pilot){const seen=await db.from('creator_research_sources').select('canonical_url').eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(1000);if(seen.error)throw Error('PERSISTENCE');for(const row of seen.data??[]){const id=videoIdentity(row.canonical_url);if(id)knownIdentities.add(id);}}
      const priorUrls = new Set(priorSources.map((source) => canonicalResearchUrl(source.url)));
      const nextSourceId = Math.max(0, ...priorSources.map((source) => source.providerSourceId));
      let freshSources = renumberNativeSources(uniqueSources.filter((source) => {
        const canonical = canonicalResearchUrl(source.url);
        return canonical && !knownUrls.has(canonical) && !priorUrls.has(canonical) && (!providerMetadata.pilot||!knownIdentities.has(videoIdentity(source.url)!));
      })).map((source) => ({ ...source, providerSourceId: source.providerSourceId + nextSourceId }));
      const freshBeforeFilters=freshSources.length;
      const filters=brief.data.discoveryFilters;
      if(filters){
        const initialFresh=freshSources.length;
        const prequalified=freshSources.filter(source=>!engagementFailure(source,{...filters,mode:'engaged'}));
        if(filters.mode==='outliers'){
          if(!Array.isArray(providerMetadata.baselineRuns)){
            const creators=[...new Map([...prequalified].sort((a,b)=>(b.engagement?.views??0)-(a.engagement?.views??0)).flatMap(source=>{const creator=sourceCreator(source);return creator?[[creatorKey(creator),creator] as const]:[];})).values()].slice(0,5);
            const baselineClaimAt=new Date().toISOString();
            const claim=await db.from('creator_research_jobs').update({status:'reviewing_sources',provider_metadata:{...providerMetadata,baselineClaimAt},updated_at:baselineClaimAt}).eq('id',job.id).eq('status','researching').select('id').maybeSingle();if(claim.error)throw Error('PERSISTENCE');if(!claim.data)return reply(headers,{job},202);
            const existingLedger=(Array.isArray(providerMetadata.scLedger)?providerMetadata.scLedger:[]) as SCLedger[];
            const baselineCreators=providerMetadata.provider==='Scrape Creators'?(scrapeUnavailable(existingLedger)?[]:creators.slice(0,Math.min(5,SC_REQUEST_LIMIT-existingLedger.length))):creators;
            const baselineLedger:SCLedger[]=[];
            const launches=await Promise.all(baselineCreators.map(async (creator,i)=>{
              if(providerMetadata.provider==='Scrape Creators'){const result=await runSCTask({id:`baseline-${i}`,platform:creator.platform,kind:'creator',creator},brief.data);baselineLedger.push(result.ledger);return {creator,runs:[{id:`sc-baseline-${i}`,platform:creator.platform,status:result.diagnostic?'FAILED':'SUCCEEDED',queryPack:[creator.url],state:result.diagnostic?'failed':'completed',sources:result.sources}],diagnostics:result.diagnostic?[result.diagnostic]:[]};}
              const launched=await startWatchlistDiscovery(brief.data,[creator],true);return {creator,runs:launched.runs,diagnostics:launched.diagnostics};
            }));
            providerMetadata.scLedger=[...existingLedger,...baselineLedger];
            if(providerMetadata.provider==='Scrape Creators')providerMetadata.searchDiagnostics={...providerMetadata.searchDiagnostics as Record<string,unknown>,requests:existingLedger.length+baselineLedger.length,creditsRemaining:[...existingLedger,...baselineLedger].reduce<number|null>((n,l)=>l.remaining===null?n:n===null?l.remaining:Math.min(n,l.remaining),null),credits:[...existingLedger,...baselineLedger].reduce((n,l)=>n+(l.credits??0),0),unreportedCharges:[...existingLedger,...baselineLedger].filter(l=>l.credits===null).length};
            const baselineRuns=launches.flatMap(x=>x.runs.map(run=>({...run,creator:x.creator,state:'state' in run?run.state:'pending'})));
            const saved=await db.from('creator_research_jobs').update({status:'researching',phase:'Comparing clips with creators’ recent video performance…',provider_metadata:{...providerMetadata,discoveryRuns:checkedRuns,baselineRuns,baselineClaimAt:undefined,baselineStartedAt:new Date().toISOString(),baselineLaunchDiagnostics:launches.flatMap(x=>x.diagnostics)},updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').eq('provider_metadata->>baselineClaimAt',baselineClaimAt).select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE');return reply(headers,{job:saved.data??job},202);
          }
          const deadline=Date.now()-Date.parse(String(providerMetadata.baselineStartedAt))>5*60*1000;
          const baselineRuns=await Promise.all((providerMetadata.baselineRuns as Array<Record<string,unknown>>).map(async run=>{
            if(run.state==='completed'||run.state==='failed')return run;
            if(deadline)return {...run,state:'failed',status:'BASELINE_DEADLINE',sources:[]};
            try{const result=await getNativeDiscoveryRun(String(run.id),4,brief.data,run.platform as NativePlatform,true);return {...run,...result};}catch{return {...run,state:'failed',status:'BASELINE_UNAVAILABLE',sources:[]};}
          }));
          for(const run of baselineRuns)if(typeof run.costUsd==='number')await db.from('creator_provider_costs').upsert({provider:'Apify',external_id:String(run.id),user_id:job.user_id,job_id:job.id,operation:'Creator performance baseline',status:String(run.status),cost_usd:run.costUsd},{onConflict:'provider,external_id'});
          providerMetadata.baselineRuns=baselineRuns;
          if(baselineRuns.some(run=>run.state==='pending')){const saved=await db.from('creator_research_jobs').update({provider_metadata:{...providerMetadata,discoveryRuns:checkedRuns},phase:'Comparing clips with creators’ recent video performance…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching').select('*').maybeSingle();if(saved.error)throw Error('PERSISTENCE');return reply(headers,{job:saved.data??job},202);}
          freshSources=freshSources.map(source=>{const creator=sourceCreator(source);const run=creator?baselineRuns.find(run=>run.state==='completed'&&creatorKey(run.creator as CreatorSource)===creatorKey(creator)):undefined;return run?attachBaseline(source,nativeSources(run.sources)):source;});
        }
        if(providerMetadata.selectionVersion===2&&filters.mode==='outliers')providerMetadata.scPool=mergePool(nativeSources(providerMetadata.scPool),freshSources,brief.data);
        if(providerMetadata.selectionVersion===2)providerMetadata.scFilterRejectedUrls=[...providerMetadata.scFilterRejectedUrls as string[]??[],...freshSources.filter(source=>engagementFailure(source,filters)).map(source=>source.url)];
        const excluded:Record<string,number>={};for(const source of freshSources){const reason=providerMetadata.selectionVersion===2?selectionReason(source,brief.data):engagementFailure(source,filters);if(reason)excluded[reason]=(excluded[reason]??0)+1;}
        freshSources=freshSources.filter(source=>!engagementFailure(source,filters)).sort((a,b)=>filters.mode==='outliers'?(b.engagement?.baseline?.ratio??0)-(a.engagement?.baseline?.ratio??0):filters.mode==='engaged'?(b.engagement?.views??0)-(a.engagement?.views??0):0);
        providerMetadata.engagementDiagnostics={...(providerMetadata.selectionVersion===2?selectionDiagnostics(nativeSources(providerMetadata.scPool),brief.data,filters.mode==='outliers'):{filters,freshCandidates:initialFresh,passed:freshSources.length,excluded}),baselineLimit:5,baselineLimitNote:'Outlier mode checks up to five creators with ten recent videos each. Missing or insufficient baseline data never qualifies as an outlier.'};
      }
      const freshByPlatform = { TikTok: 0, Instagram: 0, YouTube: 0 };
      for (const source of freshSources) freshByPlatform[sourcePlatform(source)] += 1;
      if (!freshSources.length) {
        const updated = await db.from("creator_research_jobs").update({
          status: "researching", phase: `Round ${currentRound} found no new clips; checking ${priorCandidates.length} candidates…`,
          provider_metadata: { ...providerMetadata, stage: "multi_screening", discoveryRuns: undefined,
            screeningRuns: [], nativeSources: priorSources, retainedCandidates: priorCandidates, freshSourceCount: 0, freshByPlatform,
            discoverySummary: multi ? checkedRuns.map(discoveryDiagnostics) : [] },
          updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
        return reply(headers, { job: updated.data ?? job }, 202);
      }
      const claimed = await db.from("creator_research_jobs").update({
        status: "reviewing_sources", phase: "Checking clip quality…", updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
      if (claimed.error) throw new Error(`PERSISTENCE_CLAIM_${claimed.error.code}`);
      if (!claimed.data) {
        const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
        return reply(headers, { job: current ?? job }, 202);
      }
      job = claimed.data as Record<string, unknown>;
      if(job.status==='cancelled')return reply(headers,{job});
      // A single long prompt allowed one marginal source cluster to dominate
      // the response. Screen bounded, independent groups and rank them together.
      const batchSize = 22;
      const batches = Array.from({ length: Math.ceil(freshSources.length / batchSize) }, (_, index) => freshSources.slice(index * batchSize, (index + 1) * batchSize));
      const batchTarget = Math.max(3, Math.ceil(Number(job.requested_count) / batches.length) + 2);
      const started = await Promise.allSettled(batches.slice(0,1).map((sources) =>
        startNativeVideoScreening({ brief: brief.data, requestedCount: batchTarget, sources })));
      const screeningRuns = started.flatMap((result, index) => result.status === "fulfilled"
        ? [{ id: result.value.id, status: result.value.status, sourceIds: batches[index].map((source) => source.providerSourceId) }] : []);
      const compactSources = [...priorSources, ...freshSources.map((source) => ({ ...source, snippet: providerText(source.snippet,1200) }))];
      const updated = await db.from("creator_research_jobs").update({
        provider_response_id: screeningRuns[0]?.id ?? job.provider_response_id, status: "researching",
        phase: currentRound > 1 ? `Checking clip quality (round ${currentRound} of 3; ${Number(providerMetadata.acceptedCountSoFar ?? 0)} of ${job.requested_count} strong clips so far)…` : "Ranking direct video leads…",
        provider_metadata: {
          ...providerMetadata, stage: "multi_screening", apifyStatus: discovery.status,
          discoveryRuns: undefined, discoverySummary: multi ? checkedRuns.map(discoveryDiagnostics) : [discoveryDiagnostics({id:job.provider_response_id,platform:"TikTok",...discovery})],
          screeningStartedAt:new Date().toISOString(),screeningRuns, screeningLaunchFailures: started.length - screeningRuns.length,
          pendingScreeningBatches:batches.slice(screeningRuns.length?1:0).map(sources=>sources.map(source=>source.providerSourceId)),
          nativeSources: compactSources, retainedCandidates: priorCandidates,
          accumulatedSources: undefined, accumulatedCandidates: undefined,
          discoveredSourceCount: uniqueSources.length, freshSourceCount: freshSources.length, freshByPlatform,
          duplicateSourceCount: uniqueSources.length - freshBeforeFilters,filteredSourceCount:freshBeforeFilters-freshSources.length,
        }, updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "reviewing_sources").select("*").maybeSingle();
      if (updated.error) throw new Error(`PERSISTENCE_SCREENING_${updated.error.code}`);
      if (!updated.data) {
        const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
        return reply(headers, { job: current ?? job }, 202);
      }
      return reply(headers, { job: updated.data }, 202);
    }
    const screeningStage = providerMetadata.stage === "perplexity_screening" || providerMetadata.stage === "multi_screening";
    const suppliedSources = screeningStage ? nativeSources(providerMetadata.nativeSources) : undefined;
    const previousCandidates = retainedCandidates(providerMetadata.retainedCandidates);
    const noNewScreening = providerMetadata.stage === "multi_screening" && Array.isArray(providerMetadata.screeningRuns) && providerMetadata.screeningRuns.length === 0;
    if (screeningStage && !suppliedSources?.length && !noNewScreening) throw new Error("NATIVE_SOURCES_MISSING");
    let providerRun: ProviderRun | CompletedResearchRun;
    if(inspectionRun)providerRun=inspectionRun;
    else if (providerMetadata.stage === "multi_screening") {
      if(Date.parse(String(providerMetadata.screeningRetryAt))>Date.now())return reply(headers,{job},202);
      const runs = Array.isArray(providerMetadata.screeningRuns) ? providerMetadata.screeningRuns as Array<{ id: string; sourceIds: number[] }> : [];
      const results = await Promise.all(runs.map(async (run) => {
        const ids = new Set(run.sourceIds);
        try { return await getDeepResearchRun(run.id, brief.data, suppliedSources!.filter((source) => ids.has(source.providerSourceId))); }
        catch(error) {
          if(error instanceof Error && /PROVIDER_HTTP_(429|5\d\d)/.test(error.message))return {id:run.id,status:'in_progress',usage:{}} as ProviderRun;
          throw error;
        }
      }));
      providerMetadata.screeningBatchReports=results.map(result=>({id:result.id,status:result.status,candidates:'candidates' in result&&Array.isArray(result.candidates)?result.candidates.length:0}));
      const pending=Array.isArray(providerMetadata.pendingScreeningBatches)?providerMetadata.pendingScreeningBatches as number[][]:[];
      const waiting=results.some(result=>result.status==='queued'||result.status==='in_progress');
      const waitExpired=(waiting&&reviewWaitExpired(providerMetadata.screeningStartedAt??job.created_at))||(pending.length>0&&reviewWaitExpired(providerMetadata.screeningQueueStartedAt));
      if (waiting&&!waitExpired) {
        const updated = await db.from("creator_research_jobs").update({ phase: `Checking clip quality across platforms (round ${currentRound} of 3)…`, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
        return reply(headers, { job: updated.data ?? job }, 202);
      }
      const complete = results.filter((result): result is CompletedResearchRun => result.status === "completed" && "candidates" in result);

      if(waitExpired){providerMetadata.reviewLimited=true;providerMetadata.unavailableRound=currentRound;}
      if(pending.length&&!waitExpired){
        // Claim before launching: overlapping polls cannot submit the next batch twice.
        const claim=await db.from('creator_research_jobs').update({status:'reviewing_sources'}).eq('id',job.id).eq('status','researching').select('*').maybeSingle();
        if(claim.error)throw Error(`PERSISTENCE_QUEUE_${claim.error.code}`);
        if(!claim.data)return reply(headers,{job},202);
        const ids=new Set(pending[0]);
        let next:ProviderRun;
        try{next=await startNativeVideoScreening({brief:brief.data,requestedCount:Number(job.requested_count),sources:suppliedSources!.filter(source=>ids.has(source.providerSourceId))});}
        catch(error){
          if(error instanceof Error&&error.message==='PROVIDER_HTTP_429'){
            await db.from('creator_research_jobs').update({status:'researching',provider_metadata:{...providerMetadata,screeningQueueStartedAt:providerMetadata.screeningQueueStartedAt??new Date().toISOString(),screeningRetryAt:new Date(Date.now()+30000).toISOString()},phase:'Review provider is busy; waiting to continue…'}).eq('id',job.id).eq('status','reviewing_sources');
            return reply(headers,{job},202);
          }
          throw error;
        }
        const saved=await db.from('creator_research_jobs').update({status:'researching',provider_metadata:{...providerMetadata,screeningStartedAt:new Date().toISOString(),screeningQueueStartedAt:undefined,screeningRetryAt:undefined,screeningRuns:[...runs,{id:next.id,sourceIds:pending[0]}],pendingScreeningBatches:pending.slice(1)},updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').select('*').maybeSingle();
        if(saved.error)throw Error(`PERSISTENCE_QUEUE_${saved.error.code}`);
        return reply(headers,{job:saved.data??job},202);
      }
      providerMetadata.screeningCompletedCount = complete.length;
      providerMetadata.screeningFailedCount = results.length - complete.length;
      const roundCost = complete.reduce((sum, result) => sum + (providerCost(result.usage) ?? 0), 0);
      providerRun = {
        id: complete[0]?.id ?? String(job.provider_response_id), status: "completed", model: complete[0]?.model,
        sources: suppliedSources!, candidates: [...previousCandidates, ...complete.flatMap((result) => result.candidates)],decisions:complete.flatMap(result=>result.decisions??[]),
        raw: {}, usage: { cost: { total_cost: Number(providerMetadata.accumulatedCost ?? 0) + roundCost } },
      };
    } else providerRun = await getDeepResearchRun(String(job.provider_response_id), brief.data, suppliedSources);
    if (["queued", "in_progress"].includes(providerRun.status)) {
      const phase = providerMetadata.stage === "perplexity_screening" ? "Checking clip quality…" : "Researching…";
      const updated = await db.from("creator_research_jobs").update({ status: "researching", phase, updated_at: new Date().toISOString() }).eq("id", job.id).select("*").maybeSingle();
      return reply(headers, { job: updated.data ?? job }, 202);
    }
    if (["failed", "cancelled", "incomplete"].includes(providerRun.status)) {
      await markFailed(job, `PROVIDER_${providerRun.status.toUpperCase()}`, providerRun.status === "cancelled", providerRun);
      return reply(headers, { code: `PROVIDER_${providerRun.status.toUpperCase()}` }, 503);
    }
    if (providerRun.status !== "completed" || !("candidates" in providerRun)) return reply(headers, { code: "PROVIDER" }, 502);
    if(providerMetadata.stage==='indexed_video_search'){
      const merged=mergeSearchRound({sources:nativeSources(providerMetadata.accumulatedSources),candidates:retainedCandidates(providerMetadata.accumulatedCandidates)},providerRun);
      const roundCost=providerCost(providerRun.usage)??0;
      providerMetadata.screeningCompletedCount=1;
      providerMetadata.screeningFailedCount=0;
      providerMetadata.freshSourceCount=providerRun.sources.length;
      providerMetadata.screenedCandidateCount=providerRun.candidates.length;
      providerMetadata.screeningRuns=[{id:providerRun.id,sourceIds:merged.sources.slice(nativeSources(providerMetadata.accumulatedSources).length).map(source=>source.providerSourceId)}];
      providerMetadata.discoverySummary=[{id:providerRun.id,route:'indexed_video_search',queryPack:providerMetadata.queryHints,sourceCount:providerRun.sources.length}];
      providerRun={...providerRun,...merged,usage:{cost:{total_cost:Number(providerMetadata.accumulatedCost??0)+roundCost}}};
    }
    if (!("candidates" in providerRun)) throw new Error("RESEARCH_EVIDENCE_MISSING");

    if(providerMetadata.selectionVersion===2&&!providerMetadata.pilotReviewed&&!inspectionRun){
      const priorDecisions=(providerMetadata.metadataDecisions??[]) as ScreeningDecision[];
      const decisions=screeningDecisions(providerRun.sources,providerRun.candidates,[...priorDecisions,...providerRun.decisions??[]],brief.data);
      const approved=acceptedCandidates(providerRun.candidates,decisions);
      const checkedUrls=[...new Set([...(providerMetadata.scScreenedUrls as string[]??[]),...providerRun.sources.map(s=>s.url)])];
      providerMetadata.metadataDecisions=decisions;
      providerMetadata.scScreenedUrls=checkedUrls;
      providerMetadata.scExplicitReviewedIds=[...new Set([...(providerMetadata.scExplicitReviewedIds as number[]??[]),...(providerRun.decisions??[]).map(d=>d.sourceId)])];
      providerMetadata.metadataRejectionCount=decisions.filter(d=>d.outcome==='rejected').length;
      providerMetadata.engagementDiagnostics={...providerMetadata.engagementDiagnostics as Record<string,unknown>,metadataReviewed:(providerMetadata.scExplicitReviewedIds as number[]).length,relevanceRejected:decisions.filter(d=>d.outcome==='rejected').length,needsContentReview:decisions.filter(d=>d.outcome==='needs_content_review').length};
      providerRun.candidates=approved;
      const ledger=(providerMetadata.scLedger??[]) as SCLedger[];
      if(approved.length<Number(job.requested_count)&&checkedUrls.length<40&&ledger.length<40&&!scrapeUnavailable(ledger)&&!['no_more_results','provider_limited'].includes(String((providerMetadata.searchDiagnostics as Record<string,unknown>)?.stopReason))){
        const next={...providerMetadata,stage:'scrape_discovery_v2',round:Number(providerMetadata.round??1)+1,accumulatedSources:providerRun.sources,accumulatedCandidates:approved,accumulatedCost:providerCost(providerRun.usage)??0,scInFlight:[]};
        const saved=await db.from('creator_research_jobs').update({provider_metadata:next,phase:'Replacing rejected clips with new qualifying matches…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching').eq('provider_metadata->>stage',String(providerMetadata.stage)).select('*').maybeSingle();if(saved.error)throw Error('REFILL_SAVE');return reply(headers,{job:saved.data??job},202);
      }
    }
    if(providerMetadata.pilot&&!providerMetadata.pilotReviewed){
      const inspectionCandidates=providerRun.candidates.filter(c=>c.relevanceScore>=70).sort((a,b)=>b.relevanceScore-a.relevanceScore);
      const ids=providerMetadata.selectionVersion===2?inspectionIds(inspectionCandidates,providerMetadata.metadataDecisions as ScreeningDecision[]??[]):[...new Set(inspectionCandidates.map(c=>c.sourceIds[0]))].slice(0,INSPECTION_LIMIT);
      if(ids.length){
        const next={...providerMetadata,stage:'pilot_inspection',inspectionStartedAt:new Date().toISOString(),inspectionSources:providerRun.sources.filter(s=>ids.includes(s.providerSourceId)),inspectionAllSources:providerRun.sources,inspectionCandidates:providerRun.candidates,inspectionUsage:providerRun.usage};
        const update=await db.from('creator_research_jobs').update({provider_metadata:next,phase:'Inspecting shortlisted video and speech evidence…',updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','researching').eq('provider_metadata->>stage',String(providerMetadata.stage)).select('*').maybeSingle();if(update.error)throw Error('PERSISTENCE_INSPECTION');
        return reply(headers,{job:update.data??job},202);
      }
      providerMetadata.pilotReviewed=true;
    }

    const claimed = await db.from("creator_research_jobs").update({ status: "reviewing_sources", phase: "Reviewing sources…", updated_at: new Date().toISOString() })
      .eq("id", job.id).eq("status", "researching").select("*").maybeSingle();
    if (claimed.error) throw new Error(`PERSISTENCE_CLAIM_${claimed.error.code}`);
    if (!claimed.data) {
      const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
      return reply(headers, { job: current ?? job }, 202);
    }
    job = claimed.data as Record<string, unknown>;
      if(job.status==='cancelled')return reply(headers,{job});

    const { data: duplicateRows, error: duplicateError } = await db.from("creator_research_opportunities")
      .select("title,category,status,source_snapshot").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(250);
    if (duplicateError) throw new Error("PERSISTENCE");
    const { data: historicalRows, error: historyError } = await db.from("creator_research_opportunities")
      .select("id,title,category,status,source_snapshot").eq("user_id", auth.user.id).eq("content_profile_id", job.content_profile_id).order("created_at", { ascending: false }).limit(250);
    if (historyError) throw new Error("PERSISTENCE");
    // Fetch one latest rejection per idea, not every click. Bounded parallel
    // batches avoid both PostgREST row limits and an unbounded request fan-out.
    const reasons = new Map<string, ResearchHistorySignal['rejectionReason']>();
    const rejected = (historicalRows ?? []).filter(row => row.status === 'rejected');
    for (let offset = 0; offset < rejected.length; offset += 10) {
      await Promise.all(rejected.slice(offset, offset + 10).map(async row => {
        const result = await db.from('creator_research_feedback').select('reason').eq('user_id', auth.user.id)
          .eq('opportunity_id', row.id).eq('action', 'rejected').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
        if (result.error) throw new Error('PERSISTENCE');
        reasons.set(row.id, result.data?.reason ?? null);
      }));
    }
    const history: ResearchHistorySignal[] = (historicalRows ?? []).flatMap((row) => {
      const sources = z.array(z.object({ providerSourceId: z.number(), title: z.string(), url: z.string(), snippet: z.string(), publishedAt: z.string().nullable(), sourceType: z.string() })).safeParse(row.source_snapshot);
      return sources.success ? [{ title: row.title, category: row.category, status: row.status, sourceSnapshot: sources.data, rejectionReason: reasons.get(row.id) }] : [];
    });
    const duplicateHistory: ResearchHistorySignal[] = (duplicateRows ?? []).flatMap(row => {
      const sources = z.array(z.object({ providerSourceId: z.number(), title: z.string(), url: z.string(), snippet: z.string(), publishedAt: z.string().nullable(), sourceType: z.string() })).safeParse(row.source_snapshot);
      return sources.success ? [{ title: row.title, category: row.category, status: row.status, sourceSnapshot: sources.data }] : [];
    });
    // A provider can emit low-confidence items despite on-brief instructions.
    // Keep the requested count a target, never a reason to pad weak clips.
    const blockedUrls = new Set(brief.data.researchBlockedUrls.map(canonicalResearchUrl).filter(Boolean));
    const sourcesById = new Map(providerRun.sources.map(source => [source.providerSourceId, source]));
    const eligibleCandidates = brief.data.sourceMode === 'videos'
      ? providerRun.candidates.filter((candidate) => candidate.relevanceScore >= 70 && !candidate.sourceIds.some(id => blockedUrls.has(canonicalResearchUrl(sourcesById.get(id)?.url ?? ""))))
      : qualifyArticleCandidates(providerRun.candidates,providerRun.sources,brief.data);
    if(brief.data.sourceMode==='articles')providerMetadata.articleScreening={requiredLanguage:'en',publisherPolicy:'established_news_editorial',approvedDomains:[...ARTICLE_NEWS_DOMAINS],minimumRelevance:70,candidateCount:providerRun.candidates.length,belowMinimum:providerRun.candidates.filter(c=>c.relevanceScore<70).length,unsupportedOrBlocked:providerRun.candidates.filter(c=>c.relevanceScore>=70).length-eligibleCandidates.length,eligibleCount:eligibleCandidates.length};
    const requestedCount = Number(job.requested_count);
    const rankedPool = rankResearchCandidates(eligibleCandidates, providerRun.sources, history, eligibleCandidates.length, duplicateHistory);
    if(brief.data.discoveryFilters?.mode==='outliers')rankedPool.sort((a,b)=>(b.sources[0]?.engagement?.baseline?.ratio??0)-(a.sources[0]?.engagement?.baseline?.ratio??0));
    if(brief.data.discoveryFilters?.mode==='engaged')rankedPool.sort((a,b)=>(b.sources[0]?.engagement?.views??0)-(a.sources[0]?.engagement?.views??0));
    const ranked = brief.data.sourceMode === 'videos'
      ? selectDiverseVideoCandidates(rankedPool, requestedCount)
      : rankedPool.slice(0, requestedCount);
    const priorReports = Array.isArray(providerMetadata.roundReports) ? providerMetadata.roundReports : [];
    const screenedIds = new Set((Array.isArray(providerMetadata.screeningRuns) ? providerMetadata.screeningRuns as Array<{ sourceIds: number[] }> : [])
      .flatMap((run) => Array.isArray(run.sourceIds) ? run.sourceIds : []));
    const acceptedByPlatform = { TikTok: 0, Instagram: 0, YouTube: 0 };
    for (const candidate of ranked) {
      const primary = candidate.sources[0];
      if (primary && screenedIds.has(primary.providerSourceId)) acceptedByPlatform[sourcePlatform(primary)] += 1;
    }
    const currentReport = brief.data.sourceMode === "videos" ? {
      round: currentRound, discovery: providerMetadata.discoverySummary ?? [],
      freshSourceCount: providerMetadata.freshSourceCount ?? 0, freshByPlatform: providerMetadata.freshByPlatform ?? {},
      screenedCandidateCount: providerMetadata.screenedCandidateCount ?? providerRun.candidates.length - previousCandidates.length,
      acceptedCount: ranked.length, acceptedByPlatform,
      screeningCompletedCount: providerMetadata.screeningCompletedCount ?? 0,
      screeningFailedCount: providerMetadata.screeningFailedCount ?? 0,
      screeningRunIds: (Array.isArray(providerMetadata.screeningRuns) ? providerMetadata.screeningRuns as Array<{ id: string }> : []).map((run) => run.id),
    } : null;
    const roundReports = currentReport ? [...priorReports, currentReport] : priorReports;
    if (!providerMetadata.pilot && !brief.data.discoveryFilters && brief.data.sourceMode === "videos" && ranked.length < Number(job.requested_count) && currentRound < 3 && !providerMetadata.reviewLimited) {
      // A sparse or off-topic popular feed must not be the only retrieval route.
      // Use the next bounded round for domain-filtered indexed video search.
      const nextRound=currentRound+1;
      const queryHints=buildCrossPlatformQueryPack(brief.data,`${job.id}:indexed:${nextRound}`,nextRound);
      // Prioritize already-seen clips in the bounded provider exclusion list.
      // Otherwise each new job pays to rediscover candidates ranking must reject.
      const excludeUrls=[...new Set([
        ...duplicateHistory.flatMap(item=>item.sourceSnapshot.map(source=>source.url)),
        ...providerRun.sources.map(source=>source.url),
      ])];
      const run=await startDeepResearch({brief:brief.data,requestedCount:Number(job.requested_count),candidateMultiplier:2,queryHints,excludeUrls});
      const update=await db.from('creator_research_jobs').update({
        provider_response_id:run.id,status:'researching',phase:`${ranked.length} of ${job.requested_count} found; searching indexed video links (${nextRound}/3)…`,
        provider_metadata:{stage:'indexed_video_search',round:nextRound,roundReports,queryHints,acceptedCountSoFar:ranked.length,
          accumulatedSources:providerRun.sources,accumulatedCandidates:providerRun.candidates,accumulatedCost:providerCost(providerRun.usage)??0},
        updated_at:new Date().toISOString(),
      }).eq('id',job.id).eq('status','reviewing_sources').select('*').maybeSingle();
      if(update.error)throw Error('PERSISTENCE');
      await db.from('creator_research_usage').insert({id:crypto.randomUUID(),job_id:job.id,user_id:auth.user.id,operation:'deep_research_start',provider_response_id:run.id,model:run.model,status:'started',request_metadata:{round:nextRound,route:'indexed_video_search',queryHints}});
      return reply(headers,{job:update.data??job},202);
    }
    if (!ranked.length) {

      const phase=brief.data.sourceMode==='articles'
        ? 'No strong article matches found. No ideas charged; try another search or adjust your date range.'
        : providerMetadata.unavailableRound
          ? `No strong, distinct clips found after ${currentRound} rounds. The provider could not start round ${providerMetadata.unavailableRound}. Try again later.`
          : brief.data.discoveryFilters?filteredSearchPhase():completedSearchPhase(0,Number(job.requested_count),currentRound);
      const result=await db.from('creator_research_jobs').update({status:'ready',reserved_count:0,phase,delivered_count:0,candidate_count:providerRun.candidates.length,
        provider_metadata:{...providerMetadata,roundReports,accumulatedSources:undefined,accumulatedCandidates:undefined,retainedCandidates:undefined},
        completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','reviewing_sources').select('*').maybeSingle();
      if(result.error)throw Error('PERSISTENCE');
      if(!result.data){const {data:current}=await db.from('creator_research_jobs').select('*').eq('id',job.id).maybeSingle();return reply(headers,{job:current??job},202);}
      await db.from('creator_research_usage').insert({id:crypto.randomUUID(),job_id:job.id,user_id:auth.user.id,operation:'deep_research_complete',provider_response_id:providerRun.id,model:providerRun.model,status:'completed',usage:providerRun.usage,provider_cost_usd:providerCost(providerRun.usage),accepted_count:0,request_metadata:{sourceMode:brief.data.sourceMode,articleWindow:brief.data.articleWindow}});
      return reply(headers,{job:result.data,deliveredCount:0});
    }
    const rankingClaim = await db.from("creator_research_jobs").update({ status: "ranking", phase: "Ranking opportunities…", updated_at: new Date().toISOString() })
      .eq("id", job.id).eq("status", "reviewing_sources").select("id").maybeSingle();
    if (rankingClaim.error) throw new Error("PERSISTENCE");
    if (!rankingClaim.data) {
      const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
      return reply(headers, { job: current ?? job }, 202);
    }

    const uniqueSources = new Map<string, ResearchSource>();
    for (const candidate of ranked) for (const source of candidate.sources) {
      const canonical = canonicalResearchUrl(source.url);
      if (canonical) uniqueSources.set(canonical, { ...source, url: canonical });
    }
    const urls = [...uniqueSources.keys()];
    const existingSources = await db.from("creator_research_sources").select("id,canonical_url").eq("user_id", auth.user.id).in("canonical_url", urls);
    if (existingSources.error) throw new Error("PERSISTENCE");
    const existingByUrl = new Map((existingSources.data ?? []).map((source) => [source.canonical_url, source.id]));
    const newSources = [...uniqueSources.entries()].filter(([url]) => !existingByUrl.has(url)).map(([canonicalUrl, source]) => ({
      id: crypto.randomUUID(), user_id: auth.user.id, canonical_url: canonicalUrl, title: source.title, snippet: source.snippet,
      source_type: source.sourceType, published_at: source.publishedAt, provider_source_id: source.providerSourceId,
    }));
    if (newSources.length) {
      const insertedSources = await db.from("creator_research_sources").insert(newSources).select("id,canonical_url");
      if (insertedSources.error) throw new Error("PERSISTENCE");
      for (const source of insertedSources.data ?? []) existingByUrl.set(source.canonical_url, source.id);
    }

    const opportunityRows = ranked.map((candidate) => ({
      id: crypto.randomUUID(), job_id: job!.id, user_id: auth.user.id, content_profile_id: job!.content_profile_id,
      normalized_title: candidate.normalizedTitle, title: candidate.title, factual_summary: candidate.factualSummary,
      why_audience_cares: candidate.whyAudienceCares, creator_connection: candidate.creatorConnection,
      recommended_angle: candidate.recommendedAngle, suggested_hook: candidate.suggestedHook, category: candidate.category,
      published_at: candidate.publishedAt, timeliness_score: candidate.timelinessScore, relevance_score: candidate.relevanceScore,
      rank_score: candidate.rankScore, uncertainty: candidate.uncertainty,
      evidence_state: candidate.uncertainty ? "partial" : "source_backed", source_snapshot: candidate.sources,
    }));
    const insertedOpportunities = await db.from("creator_research_opportunities").insert(opportunityRows).select("id,source_snapshot");
    if (insertedOpportunities.error || !insertedOpportunities.data) throw new Error("PERSISTENCE");
    const sourceLinks = insertedOpportunities.data.flatMap((opportunity, index) =>
      (opportunity.source_snapshot as ResearchSource[]).flatMap((source, sourceIndex) => {
        const id = existingByUrl.get(canonicalResearchUrl(source.url) ?? "");
        return id ? [{ opportunity_id: opportunity.id, source_id: id, source_order: sourceIndex + 1 }] : [];
      }),
    );
    if (sourceLinks.length) {
      const links = await db.from("creator_research_opportunity_sources").insert(sourceLinks);
      if (links.error) throw new Error("PERSISTENCE");
    }
    const shown = await db.from("creator_research_feedback").insert(insertedOpportunities.data.map((opportunity) => ({
      id: crypto.randomUUID(), opportunity_id: opportunity.id, user_id: auth.user.id, action: "shown", metadata: { jobId: job!.id },
    })));
    if (shown.error) throw new Error("PERSISTENCE");

    const delivered = insertedOpportunities.data.length;

    const usage = providerRun.usage;
    const finalJob = await db.from("creator_research_jobs").update({
      status: "ready", reserved_count:0, phase: brief.data.sourceMode==='articles'?`${delivered} articles ready.${delivered<Number(job.requested_count)?' Fewer relevant, dated, new stories were available in this window.':''}`:completedSearchPhase(delivered,Number(job.requested_count),currentRound,Number(providerMetadata.unavailableRound)||undefined), delivered_count: delivered, candidate_count: providerRun.candidates.length,
      provider_metadata:{...providerMetadata,roundReports,accumulatedSources:undefined,accumulatedCandidates:undefined,retainedCandidates:undefined},
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "ranking").select("*").maybeSingle();
    if (finalJob.error) throw new Error("PERSISTENCE");
    if (!finalJob.data) {
      const { data: current } = await db.from("creator_research_jobs").select("*").eq("id", job.id).maybeSingle();
      return reply(headers, { job: current ?? job }, 202);
    }
    await db.from("creator_research_usage").insert({
      id: crypto.randomUUID(), job_id: job.id, user_id: auth.user.id, operation: "deep_research_complete",
      provider_response_id: providerRun.id, model: providerRun.model ?? null, status: "completed", usage,
      provider_cost_usd: providerCost(usage), candidate_count: providerRun.candidates.length, accepted_count: delivered,
      elapsed_ms: job.started_at ? Date.now() - new Date(String(job.started_at)).getTime() : null,
      request_metadata: { requestedCount: job.requested_count, sourceCount: providerRun.sources.length,sourceMode:brief.data.sourceMode,articleWindow:brief.data.articleWindow,review:providerMetadata.reviewDiagnostics,search:providerMetadata.searchDiagnostics },
    });
    return reply(headers, { job: finalJob.data, deliveredCount: delivered });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "UNAVAILABLE";
    if (job) {
      const current=await db.from('creator_research_jobs').select('*').eq('id',job.id).maybeSingle();
      if(current.data?.status==='cancelled')return reply(headers,{job:current.data});
      // Keep results already saved, even if a later linking operation failed.
      await markFailed(job, code);
    }
    return reply(headers, { code: "RESEARCH_SYNC_FAILED" }, 503);
  }
});
