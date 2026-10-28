import {directSearchBrief} from '../../../src/domain/direct-search.ts';
import {scrapeEnabled,scrapeTasks} from '../_shared/scrape-creators.ts';
import {indexedVideoSearch,youtubeSearch} from '../_shared/discovery-search.ts';
import {startWatchlistDiscovery} from '../_shared/platform-discovery.ts';
import {creatorSourceSchema,incomeSearchLanes} from '../../../src/domain/discovery-pilot.ts';
import { createClient } from "@supabase/supabase-js";
import { isAllowedAppOrigin } from "../_shared/app-origins.ts";
import { startPlatformDiscovery, type NativePlatform } from "../_shared/platform-discovery.ts";
import {startDeepResearch} from '../_shared/research-provider.ts';
import {resolveArticleWindow} from '../../../src/domain/research-window.ts';
import { researchBriefSchema, researchRequestSchema, type ResearchBrief } from "../../../src/domain/research.ts";
import { qualityFromRow, qualityInstruction, searchQualitySettingsSchema } from "../../../src/domain/search-quality.ts";

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type Entitlement = { enabled: boolean; monthly_opportunity_limit: number; period_start: string; delivered_count: number; reserved_count: number };
const currentPeriod = () => new Date().toISOString().slice(0, 7) + "-01";

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
function safeCode(error: unknown) {
  if(error instanceof Error&&error.message==='ARTICLE_DATE_RANGE')return 'ARTICLE_DATE_RANGE';
  if (error instanceof Error && ["APIFY_NOT_CONFIGURED", "APIFY_PROVIDER", "PERSISTENCE", "ENTITLEMENT", "QUOTA"].includes(error.message)) return error.message;
  return "UNAVAILABLE";
}

async function releaseReservation(userId: string, amount: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await db.from("creator_research_entitlements").select("reserved_count,delivered_count,period_start").eq("user_id", userId).maybeSingle();
    if (!data) return;
    const result = await db.from("creator_research_entitlements")
      .update({ reserved_count: Math.max(0, Number(data.reserved_count) - amount), updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("reserved_count", data.reserved_count).select("user_id");
    if (!result.error && result.data?.length) return;
  }
}

async function reserve(userId: string, count: number): Promise<Entitlement> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db.from("creator_research_entitlements")
      .select("enabled,monthly_opportunity_limit,period_start,delivered_count,reserved_count")
      .eq("user_id", userId).maybeSingle();
    if (error) throw new Error("PERSISTENCE");
    if (!data || !data.enabled) throw new Error("ENTITLEMENT");
    const entitlement = data as Entitlement;
    const shouldReset = entitlement.period_start !== currentPeriod();
    const delivered = shouldReset ? 0 : Number(entitlement.delivered_count);
    const reserved = shouldReset ? 0 : Number(entitlement.reserved_count);
    if (delivered + reserved + count > Number(entitlement.monthly_opportunity_limit)) throw new Error("QUOTA");
    const updated = await db.from("creator_research_entitlements")
      .update({ period_start: currentPeriod(), delivered_count: delivered, reserved_count: reserved + count, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("period_start", entitlement.period_start)
      .eq("delivered_count", entitlement.delivered_count).eq("reserved_count", entitlement.reserved_count)
      .select("enabled,monthly_opportunity_limit,period_start,delivered_count,reserved_count");
    if (!updated.error && updated.data?.[0]) return updated.data[0] as Entitlement;
  }
  throw new Error("CONCURRENT_REQUEST");
}

function buildBrief(creator: Record<string, unknown> | null, profile: Record<string, unknown>): ResearchBrief {
  const creatorContext = (creator?.context ?? {}) as Record<string, unknown>;
  const strategy = (profile.strategy ?? {}) as Record<string, unknown>;
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const platforms = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is ResearchBrief["researchSourcePlatforms"][number] => item === "TikTok" || item === "Instagram" || item === "YouTube")
    : [];
  return researchBriefSchema.parse({
    expertise: creatorContext.expertise ?? "", experience: creatorContext.experience ?? "", industries: strings(creatorContext.industries),
    communicationStyle: creatorContext.communication_style ?? "", creatorTone: strings(creatorContext.tone),
    phrasesToAvoid: strings(creatorContext.phrases_to_avoid), preferredCtaStyle: creatorContext.preferred_cta_style ?? "",
    creatorContext: creatorContext.additional_context ?? "", audienceName: profile.name ?? "", primaryAudience: profile.primary_audience ?? "",
    audienceProblems: strings(strategy.audience_problems), audienceInterests: strings(strategy.audience_interests),
    contentPillars: strings(strategy.content_pillars), sourceTopics: strings(strategy.source_topics), reactionAngles: strings(strategy.reaction_angles),
    desiredOutcomes: strings(strategy.desired_outcomes), profileTone: strings(strategy.tone), thingsToAvoid: strings(strategy.things_to_avoid),
    profileContext: strategy.additional_context ?? "",
    researchSourcePlatforms: platforms(strategy.research_source_platforms),
    researchScreeningCriteria: typeof strategy.research_screening_criteria === "string" ? strategy.research_screening_criteria : "",
    researchReferenceUrls: strings(strategy.research_reference_urls),
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = headersFor(origin);
  if (origin && !isAllowedAppOrigin(origin, Deno.env.get("APP_ORIGIN"), Deno.env.get("CREATOR_ADDITIONAL_ORIGINS"))) return reply(headers, { code: "ORIGIN" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(headers, { code: "METHOD" }, 405);
  let jobId: string | null = null;
  let reservation = 0;
  let userId: string | null = null;
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return reply(headers, { code: "AUTH" }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply(headers, { code: "AUTH" }, 401);
    userId = auth.user.id;
    const input = researchRequestSchema.parse(await request.json());
    const { data: existing, error: existingError } = await db.from("creator_research_jobs").select("*")
      .eq("user_id", userId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existingError) throw new Error("PERSISTENCE");
    if (existing) return reply(headers, { job: existing, reused: true });

    const { data: config, error: configError } = await db.from("creator_research_config")
      .select("feature_enabled,candidate_multiplier").eq("id", true).maybeSingle();
    if (configError) throw new Error("PERSISTENCE");
    if (!config?.feature_enabled) return reply(headers, { code: "FEATURE_DISABLED" }, 403);

    const { data: profile, error: profileError } = await db.from("content_profiles")
      .select("id,user_id,creator_profile_id,name,primary_audience,strategy").eq("id", input.profileId).eq("user_id", userId).maybeSingle();
    if (profileError || !profile) return reply(headers, { code: "PROFILE" }, 403);
    const { data: creator } = await db.from("creator_profiles").select("context").eq("id", profile.creator_profile_id).eq("user_id", userId).maybeSingle();
    let brief = buildBrief(creator as Record<string, unknown> | null, profile as Record<string, unknown>);
    const { data: qualityRow, error: qualityError } = await db.from("creator_search_quality").select("*").eq("content_profile_id", input.profileId).maybeSingle();
    if (qualityError) throw new Error("PERSISTENCE");
    const defaults = await db.from('creator_search_defaults').select('settings').eq('creator_id',profile.creator_profile_id).maybeSingle();
    if(defaults.error)throw new Error('PERSISTENCE');
    if (qualityRow?.enabled || defaults.data?.settings) {
      const quality = qualityRow?.enabled ? qualityFromRow(qualityRow) : searchQualitySettingsSchema.parse(defaults.data!.settings);
      brief.researchSourcePlatforms = quality.platforms;
      // Saved owner instructions replace old screening text, rather than
      // appending contradictory requirements that the owner just removed.
      brief.researchScreeningCriteria = qualityInstruction(quality);
      brief.researchSeekSituations = quality.seekSituations;
      brief.researchBlockedUrls = quality.badExamples;
    }
    brief = directSearchBrief(brief,input.searchQuery,input.useContentProfile);
    brief.sourceMode=input.sourceMode;
    if(input.sourceMode==='videos'&&input.discoveryFilters){brief.discoveryFilters=input.discoveryFilters;brief.researchSourcePlatforms=input.discoveryFilters.platform==='all'?['TikTok','Instagram','YouTube']:[input.discoveryFilters.platform];}
    if(input.sourceMode==='articles'){
      brief.articleWindow=resolveArticleWindow(input.articleDate??{preset:'week',timezone:'UTC'});
      brief.researchSourcePlatforms=[];
      brief.researchScreeningCriteria='';
      brief.researchReferenceUrls=[];
    }

    const pilot=await db.from('creator_discovery_pilot').select('enabled').eq('content_profile_id',input.profileId).maybeSingle();
    if(pilot.error)throw Error('PERSISTENCE');
    brief.discoveryPilot=input.sourceMode==='videos'&&pilot.data?.enabled===true;
    const watch=brief.discoveryPilot&&input.useContentProfile&&!input.searchQuery?await db.from('creator_discovery_watchlist').select('platform,identifier,url,name').eq('content_profile_id',input.profileId).eq('user_id',userId):{data:[],error:null};
    if(watch.error)throw Error('PERSISTENCE');
    const watchlist=(watch.data??[]).flatMap(row=>{const parsed=creatorSourceSchema.safeParse(row);return parsed.success?[parsed.data]:[];});
    await reserve(userId, input.requestedCount);
    reservation = input.requestedCount;
    jobId = crypto.randomUUID();
    const inserted = await db.from("creator_research_jobs").insert({
      id: jobId, user_id: userId, content_profile_id: input.profileId, idempotency_key: input.idempotencyKey,
      requested_count: input.requestedCount, reserved_count: reservation, input_snapshot: brief,
    }).select("*").maybeSingle();
    if (inserted.error || !inserted.data) {
      if (inserted.error?.code === "23505") {
        await releaseReservation(userId, reservation);
        const { data: concurrent } = await db.from("creator_research_jobs").select("*").eq("user_id", userId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
        if (concurrent) return reply(headers, { job: concurrent, reused: true });
      }
      throw new Error("PERSISTENCE");
    }

    reservation=0; // After insertion the job's terminal transition settles quota atomically.
    if(input.sourceMode==='articles'){
      const run=await startDeepResearch({brief,requestedCount:input.requestedCount,candidateMultiplier:1});
      const updated=await db.from('creator_research_jobs').update({provider_response_id:run.id,status:'researching',phase:'Finding relevant web articles…',started_at:new Date().toISOString(),provider_metadata:{stage:'article_research',sourceMode:'articles'},updated_at:new Date().toISOString()}).eq('id',jobId).select('*').maybeSingle();
      if(updated.error||!updated.data)throw Error('PERSISTENCE');
      await db.from('creator_research_usage').insert({id:crypto.randomUUID(),job_id:jobId,user_id:userId,operation:'deep_research_start',provider_response_id:run.id,model:run.model,status:'started',request_metadata:{requestedCount:input.requestedCount,sourceMode:'articles',articleWindow:brief.articleWindow}});
      reservation=0;return reply(headers,{job:updated.data,reused:false},202);
    }
    if(brief.discoveryPilot&&scrapeEnabled()){
      if(!Deno.env.get('CREATOR_SCRAPECREATORS_API_KEY'))throw Error('SCRAPECREATORS_NOT_CONFIGURED');
      const saved=await db.from('creator_research_jobs').update({provider_response_id:jobId,status:'researching',phase:'Preparing Scrape Creators platform searches…',started_at:new Date().toISOString(),provider_metadata:{stage:'scrape_discovery_v2',selectionVersion:2,pilot:true,provider:'Scrape Creators',round:1,scTasks:scrapeTasks(brief,jobId!,watchlist),scSources:[],scLedger:[],providerDiagnostics:[],roundReports:[],accumulatedSources:[],accumulatedCandidates:[]},updated_at:new Date().toISOString()}).eq('id',jobId).select('*').maybeSingle();if(saved.error||!saved.data)throw Error('PERSISTENCE');
      await db.from('creator_research_usage').insert({id:crypto.randomUUID(),job_id:jobId,user_id:userId,operation:'deep_research_start',model:'scrape-creators-discovery',status:'started',request_metadata:{requestedCount:input.requestedCount,filters:input.discoveryFilters,provider:'Scrape Creators',maxRequests:40}});
      return reply(headers,{job:saved.data,reused:false},202);
    }
    const requestedPlatforms = brief.researchSourcePlatforms.filter((platform): platform is NativePlatform =>
      platform === "TikTok" || platform === "YouTube" || platform === "Instagram");
    const platformsToSearch: NativePlatform[] = [...new Set<NativePlatform>(requestedPlatforms.length ? requestedPlatforms : ["TikTok", "Instagram", "YouTube"])];
    const [launches,watchRuns,indexed,youtube]=await Promise.all([
      Promise.allSettled(platformsToSearch.map(platform=>startPlatformDiscovery({brief,requestedCount:input.requestedCount,seed:jobId??undefined,round:1,platform}))),
      brief.discoveryPilot?startWatchlistDiscovery(brief,watchlist):Promise.resolve({runs:[],diagnostics:[]}),
      brief.discoveryPilot?indexedVideoSearch(brief,jobId!):Promise.resolve({sources:[],diagnostics:[]}),
      brief.discoveryPilot&&platformsToSearch.includes('YouTube')?youtubeSearch(brief,watchlist,jobId!):Promise.resolve({sources:[],diagnostics:[]}),
    ]);
    const discoveryRuns = launches.flatMap((result) => result.status === "fulfilled" ? [{ ...result.value, state: "pending" as const }] : []);
    discoveryRuns.push(...watchRuns.runs.map(run=>({...run,state:'pending' as const,watchlist:true})));
    if (!discoveryRuns.length && !indexed.sources.length && !youtube.sources.length) throw new Error('APIFY_PROVIDER');
    const providerRun = discoveryRuns[0]??{id:jobId,status:'completed',platform:'YouTube',queryPack:[]};
    const updated = await db.from("creator_research_jobs").update({
      provider_response_id: providerRun.id, status: "researching", phase: "Finding direct social videos…", started_at: new Date().toISOString(),
      provider_metadata: { stage: 'multi_discovery',pilot:brief.discoveryPilot,additionalSources:[...indexed.sources,...youtube.sources],providerDiagnostics:[...indexed.diagnostics,...youtube.diagnostics,...watchRuns.diagnostics],searchDiagnostics:{indexedQueries:'queryCount' in indexed?indexed.queryCount:0,youtubeCalls:'quotaCalls' in youtube?youtube.quotaCalls:0},queryLanes:brief.discoveryPilot?incomeSearchLanes(brief.sourceTopics.slice(0,2).join(' '),jobId!):undefined, round: 1, discoveryRuns, roundReports: [], accumulatedSources: [], accumulatedCandidates: [], launchFailures: launches.filter((result) => result.status === "rejected").length },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId).select("*").maybeSingle();
    if (updated.error || !updated.data) throw new Error("PERSISTENCE");
    await db.from("creator_research_usage").insert({
      id: crypto.randomUUID(), job_id: jobId, user_id: userId, operation: "deep_research_start", provider_response_id: providerRun.id,
      model: "apify-multi-platform-discovery", status: "started", request_metadata: { requestedCount: input.requestedCount, platforms: discoveryRuns.map((run) => run.platform),pilot:brief.discoveryPilot },
    });
    if(brief.discoveryPilot)await db.from('creator_research_usage').insert({id:crypto.randomUUID(),job_id:jobId,user_id:userId,operation:'deep_research_start',model:'perplexity-search',status:'completed',provider_cost_usd:null,usage:{query_count:'queryCount' in indexed?indexed.queryCount:0},request_metadata:{route:'supplementary_web_discovery',diagnostics:indexed.diagnostics,costStatus:'Provider charge not reported; unknown, not free'}});
    reservation = 0;
    return reply(headers, { job: updated.data, reused: false }, 202);
  } catch (error) {
    const code = safeCode(error);
    if (jobId && userId) {
      await db.from("creator_research_jobs").update({ status: "failed", reserved_count:0, phase: "Research unavailable", error_code: code, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", jobId);
      await db.from("creator_research_usage").insert({ id: crypto.randomUUID(), job_id: jobId, user_id: userId, operation: "deep_research_failed", status: "failed", request_metadata: { code } });
    }
    if (userId && reservation) await releaseReservation(userId, reservation);
    const status = code === "ENTITLEMENT" || code === "FEATURE_DISABLED" ? 403 : code === "QUOTA" ? 429 : code === "NOT_CONFIGURED" ? 503 : 503;
    return reply(headers, { code }, status);
  }
});
