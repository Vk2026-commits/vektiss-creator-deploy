import {collectEngagement} from '../../../src/domain/discovery-engagement.ts';
import {creatorFromUrl,incomeSearchLanes} from '../../../src/domain/discovery-pilot.ts';
import {providerText} from '../../../src/domain/provider-text.ts';
import { canonicalResearchUrl, researchSourceSchema, type ResearchBrief, type ResearchSource } from "../../../src/domain/research.ts";
import {wantsVisibleAction,actionFormatRejection} from '../../../src/domain/search-intent.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

const APIFY_API = "https://api.apify.com/v2";
const TIKTOK_ACTOR = "clockworks~tiktok-scraper";
const YOUTUBE_ACTOR = "streamers~youtube-scraper";
const INSTAGRAM_ACTOR = "apify~instagram-search-scraper";
export type NativePlatform = "TikTok" | "YouTube" | "Instagram";
const activeStatuses = new Set(["READY", "RUNNING"]);
const failedStatuses = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

export type NativeDiscoveryRun = {
  id: string;
  status: string;
  platform: NativePlatform;
  queryPack: string[];
};

export type NativeDiscoveryResult = { costUsd?: number | null } & (
  | { state: "pending"; status: string }
  | { state: "failed"; status: string }
  | { state: "completed"; status: string; sources: ResearchSource[]; rawCount?: number; invalidCount?: number; formatRejectedCount?: number; duplicateCount?: number });

export function discoveryDiagnostics(run:Record<string,unknown>) {
 return {id:run.id,platform:run.platform,status:run.status,queryPack:run.queryPack,
  sourceCount:Array.isArray(run.sources)?run.sources.length:0,
  rawCount:run.rawCount??null,invalidCount:run.invalidCount??null,
  formatRejectedCount:run.formatRejectedCount??null,duplicateCount:run.duplicateCount??null};
}

function apifyToken(): string {
  const token = Deno.env.get("CREATOR_APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_NOT_CONFIGURED");
  return token;
}

async function apify(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${APIFY_API}${path}`, {
    ...init,
    signal:init.signal??AbortSignal.timeout(15000),
    headers: {
      authorization: `Bearer ${apifyToken()}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`APIFY_HTTP_${response.status}`);
  if (!payload || typeof payload !== "object") throw new Error("APIFY_PROVIDER");
  return payload as Record<string, unknown>;
}

/**
 * These scenarios are intentionally concrete. Generic safety searches surface news
 * coverage and reaction videos; scenario language surfaces the original footage
 * types Steve can teach from.
 */
function queryRotation(value: string): number {
  return [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function requestedQueries(brief:ResearchBrief,seed:string,round:number,instagram=false):string[]|null {
 const safety=/safety|security|de-escalation/i.test([...brief.sourceTopics,...brief.contentPillars,brief.expertise].join(' '));
 const explicit=(brief.researchSeekSituations??'').split(/[\n;,]+/).map(s=>s.trim()).filter(s=>s.length>3&&s.length<100&&!/^(avoid|reject|do not|don't|no )/i.test(s));
 const action=safety&&wantsVisibleAction(brief);
 if(!action&&!explicit.length)return null;
 const rounds=[
  ['security guard de-escalates confrontation caught on camera','store employee intervenes aggressive customer footage','bystander intervenes harassment CCTV','doorbell camera attempted entry homeowner response','security separates fight original footage'],
  ['shop worker stops assault surveillance footage','public transport confrontation intervention footage','security removes aggressive visitor bodycam','bystander helps person escape confrontation camera','doorbell unwanted visitor leaves intervention footage'],
  ['restaurant staff defuses confrontation CCTV','security officer breaks up altercation footage','bus driver intervenes passenger harassment camera','shopkeeper confronts intruder security camera','crowd intervenes stops assault original footage'],
 ];
 const tags=[['security intervention','caught on camera','de escalation','doorbell footage','CCTV incident'],['bystander intervention','bodycam footage','store confrontation','security guard intervention','public transport incident'],['restaurant confrontation','surveillance footage','shopkeeper intervention','bus driver intervention','conflict resolution footage']];
 const index=Math.max(0,Math.min(2,round-1));
 const base=action?(instagram?tags[index]:rounds[index]):[];
 const selected=explicit.length?explicit.slice((index*2)%explicit.length).concat(explicit).slice(0,2):[];
 const queries=[...selected.map(s=>s.replace(/\s+/g,' ').trim()),...base];
 const unique=[...new Set(queries)];
 const start=queryRotation(seed)%Math.max(1,base.length);
 return explicit.length?unique.slice(0,5):[...unique.slice(start),...unique.slice(0,start)].slice(0,5);
}

export function buildTikTokQueryPack(brief: ResearchBrief, seed = "", round = 1): string[] {
 if(brief.discoveryPilot)return incomeSearchLanes(brief.sourceTopics.slice(0,2).join(' '),seed);
  const requested=requestedQueries(brief,seed,round); if(requested)return requested;
  const topics = [...brief.sourceTopics, ...brief.contentPillars, ...brief.audienceInterests];
  const safetyProfile = /women.?s? safety|personal safety|situational awareness/i.test(topics.join(' '));
  if (!safetyProfile) {
    const cleanTopics = (values: string[]) => values.flatMap(topic => topic.split(/[.,;!?:\n]|—/))
      .map(topic => topic.trim().replace(/^(?:and|or|including|such as)\s+/i, ''))
      .filter(topic => {
        const words=topic.split(/\s+/);
        return words.length>=2 && words.length<=8 && topic.length<=85
          && !/\b(prioritize|explain|should|someone|content|opportunity|look for|want|make sure|teach|help people)\b/i.test(topic);
      });
    const terms = [...new Set(cleanTopics(topics))];
    if(!terms.length)terms.push(...cleanTopics([brief.expertise,brief.audienceName,brief.primaryAudience]));
    if (!terms.length) throw new Error('RESEARCH_TOPICS_REQUIRED');
    const start = queryRotation(`${brief.audienceName}:${seed}`) % terms.length;
    return Array.from({length:Math.min(3,terms.length)},(_,offset)=>terms[(start+offset)%terms.length]);
  }
  const scenarios = [
    ["woman followed parking lot gets help original video", "store employee walks woman to car safety original video", "woman followed in store staff helps security camera", "doorbell camera stranger approaches driveway woman safe", "security guard removes aggressive man from store original video", "woman asks for help parking lot gets to safety video"],
    ["woman notices stranger following grocery store original video", "woman asks store employee escort to car original video", "ring doorbell unwanted man on porch woman original video", "woman confronted at gas station gets help original video", "bystanders help harassed woman on sidewalk original video", "woman avoids suspicious person parking garage original video"],
    ["woman followed while shopping security guard intervenes original", "doorbell video stranger tries front door woman home original", "woman gets help after parking garage following original", "rideshare driver helps woman unsafe pickup original video", "customer helps woman leave aggressive encounter original", "woman calls staff after unwanted approach store original video"],
  ][Math.max(0, Math.min(2, round - 1))];
  // Rotate concrete scenarios between searches. Generic "security footage" terms
  // repeatedly returned AI clips, animals, and news reposts; a seed keeps each
  // run deterministic while exposing a different three-scenario slice.
  const start = queryRotation(`${brief.profileContext}:${seed}`) % scenarios.length;
  return Array.from({ length: 5 }, (_, offset) => scenarios[(start + offset) % scenarios.length]);
}

export function buildCrossPlatformQueryPack(brief: ResearchBrief, seed = "", round = 1): string[] {
 if(brief.discoveryPilot)return incomeSearchLanes(brief.sourceTopics.slice(0,2).join(' '),seed);
  const requested=requestedQueries(brief,seed,round); if(requested)return requested;
  // Use shorter, incident-oriented phrases for Shorts and Reels search. Long
  // TikTok-style phrases tend to return unrelated keyword coincidences there.
  const safety = /women.?s? safety|personal safety|situational awareness/i.test(
    [...brief.sourceTopics, ...brief.contentPillars, ...brief.audienceInterests].join(" "),
  );
  if (!safety) return buildTikTokQueryPack(brief, seed, round).slice(0, 3);
  const scenarios = [
    ["woman followed parking lot help", "store staff helps woman safety", "doorbell camera stranger driveway", "woman escapes harassment store", "security guard helps woman", "woman asks for help public place"],
    ["woman followed grocery store employee help", "woman escorted to car store staff", "unwanted visitor doorbell camera woman", "woman gets help gas station stranger", "bystanders help woman sidewalk harassment", "woman followed parking garage help"],
    ["woman followed shopping security intervenes", "stranger tries front door ring camera", "woman seeks help parking garage follower", "rideshare unsafe pickup woman help", "customer helps woman escape aggressive man", "staff helps woman leave store confrontation"],
  ][Math.max(0, Math.min(2, round - 1))];
  const start = queryRotation(`${brief.profileContext}:${seed}:cross-platform`) % scenarios.length;
  return Array.from({ length: 5 }, (_, offset) => scenarios[(start + offset) % scenarios.length]);
}

export function buildInstagramQueryPack(brief: ResearchBrief, seed = "", round = 1): string[] {
 if(brief.discoveryPilot)return incomeSearchLanes(brief.sourceTopics.slice(0,2).join(' '),seed);
  const requested=requestedQueries(brief,seed,round,true); if(requested)return requested;
  const safety = /women.?s? safety|personal safety|situational awareness/i.test(
    [...brief.sourceTopics, ...brief.contentPillars, ...brief.audienceInterests].join(" "),
  );
  if (!safety) return buildCrossPlatformQueryPack(brief, seed, round).slice(0, 5);
  // The provider accepts multiword keywords. Do not fabricate hashtags by joining words.
  const terms = [
    ["women safety", "parking lot safety", "doorbell camera", "stalking awareness", "store safety", "rideshare safety"],
    ["followed in store", "parking lot incident", "ring doorbell", "unwanted visitor", "security escort", "gas station safety"],
    ["followed while walking", "parking garage safety", "doorbell footage", "store security", "unsafe encounter", "bystander help"],
  ][Math.max(0, Math.min(2, round - 1))];
  const start = queryRotation(`${brief.profileContext}:${seed}:instagram`) % terms.length;
  return Array.from({ length: 5 }, (_, offset) => terms[(start + offset) % terms.length]);
}

// Removing clips already shown to a creator leaves gaps in the native ids.
// Give the screener a small, contiguous set of ids so its source references
// can be validated without accidentally dropping the whole batch.
export function renumberNativeSources(sources: ResearchSource[]): ResearchSource[] {
  return sources.map((source, index) => ({ ...source, providerSourceId: index + 1 }));
}

function nativeTikTokUrl(value: string): string | null {
  const canonical = canonicalResearchUrl(value);
  if (!canonical) return null;
  try {
    const url = new URL(canonical);
    const isTikTok = url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com");
    return isTikTok && /^\/@[^/]+\/video\/\d+/.test(url.pathname) ? canonical : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) if (typeof record[key] === "string" && record[key].trim()) return record[key] as string;
  return "";
}

/**
 * Reject only self-declared disqualifiers before the AI screen. This stops an
 * otherwise plausible caption from turning fiction, news packaging, or a
 * staged format into a manual-review lead. Ambiguous authentic footage still
 * goes to the screen and is explicitly marked for human review there.
 */
export function automaticTikTokRejectReason(text: string): string | null {
  const normalized = text.toLowerCase().replace(/[\s#_-]+/g, " ");
  if (/\b(horrortok|creepypasta|analog horror|found footage|scarytok|scary story|paranormal|supernatural|haunted|fiction(?:al)?|fake|ultra realistic|ai generated|artificial intelligence|deepfake|animation)\b/.test(normalized)) return "fiction";
  if (/\b(abc news|cbs news|fox news|nbc|ctv news|inside edition|good morning america|gma|tmz|breaking news|newsner)\b/.test(normalized)) return "news";
  if (/\b(storytime|reenactment|re enactment|skit|prank|compilation|shorts)\b/.test(normalized)) return "format";
  if (/\b(dog|cat|animal|pet)\b/.test(normalized)) return "off_brief";
  if (/\b(tiktok pakistan|pakistan|polisi|mexico)\b/.test(normalized)) return "setting";
  return null;
}

function dateValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }
  return null;
}

export function sourceFromTiktokItem(item: unknown, index: number, safetyProfile = true,baseline=false): ResearchSource | null {
  const record = asRecord(item);
  if (!record) return null;
  const author = asRecord(record.author) ?? asRecord(record.authorMeta) ?? {};
  const videoId = stringValue(record, ["id", "videoId", "aweme_id"]);
  const authorName = stringValue(author, ["uniqueId", "name", "username"]);
  const direct = [
    stringValue(record, ["webVideoUrl", "shareUrl", "videoUrl", "url"]),
    authorName && videoId ? `https://www.tiktok.com/@${authorName.replace(/^@/, "")}/video/${videoId}` : "",
  ].map(nativeTikTokUrl).find(Boolean);
  if (!direct) return null;

  const description = stringValue(record, ["text", "desc", "description"]);
  const subtitles = stringValue(record, ["subtitles", "textExtra"]);
  const sourceText = [description, subtitles, authorName].filter(Boolean).join("\n");
  if (safetyProfile && automaticTikTokRejectReason(sourceText)) return null;
  if (!baseline && (sourceText.replace(/[^a-z0-9]/gi, "").length < 35 || /^tiktok video from /i.test(description))) return null;
  const snippet = providerText([description, subtitles].filter(Boolean).join("\n"),5000);
  const title = providerText((description || `TikTok video from ${authorName || "creator"}`).replace(/\s+/g, " ").trim(),300);
  return researchSourceSchema.parse({
    providerSourceId: index + 1,
    title: title || "TikTok video lead",
    engagement:collectEngagement(record,'Apify'),
    creator:creatorFromUrl(direct)??undefined,
    url: direct,
    snippet,
    publishedAt: dateValue(record.createTime ?? record.createTimeISO ?? record.timestamp),
    sourceType: "tiktok-native",
  });
}

export function sourceFromCrossPlatformItem(item: unknown, index: number, platform: Exclude<NativePlatform, "TikTok">,baseline=false): ResearchSource | null {
  const record = asRecord(item);
  if (!record) return null;
  const rawUrl = stringValue(record, ["url", "videoUrl", "webVideoUrl", "shortCodeUrl", "permalink"]);
  let url = canonicalResearchUrl(rawUrl);
  if (!url) return null;
  const parsed = new URL(url);
  if (platform === "YouTube") {
    const status = asRecord(record.status) ?? {};
    const contentDetails = asRecord(record.contentDetails) ?? {};
    const contentRating = asRecord(contentDetails.contentRating) ?? {};
    if (record.isPrivate === true || record.isAgeRestricted === true || record.isMembersOnly === true ||
      record.isAvailable === false || record.isEmbeddable === false || status.embeddable === false ||
      (typeof status.privacyStatus === "string" && status.privacyStatus !== "public") ||
      contentRating.ytRating === "ytAgeRestricted") return null;
    if (record.type && record.type !== "shorts") return null;
    if (!/(^|\.)youtube\.com$/.test(parsed.hostname) && parsed.hostname !== "youtu.be") return null;
    const id = parsed.pathname.startsWith("/shorts/") ? parsed.pathname.split("/")[2]
      : parsed.searchParams.get("v") || (parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : "");
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    url = `https://www.youtube.com/shorts/${id}`;
  } else {
    if (!/(^|\.)instagram\.com$/.test(parsed.hostname)) return null;
    const shortCode = stringValue(record, ["shortCode", "shortcode"]);
    // The popular-Reels actor returns Video records at /p/<shortcode>/.
    // Requiring /reel/ before normalizing silently discarded most results.
    if (record.type && record.type !== "Video" && !parsed.pathname.startsWith("/reel/")) return null;
    if (shortCode && /^[A-Za-z0-9_-]+$/.test(shortCode)) url = `https://www.instagram.com/reel/${shortCode}/`;
    else if (!/^\/reel\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname)) return null;
  }
  const title = stringValue(record, ["title", "caption", "description", "text"]);
  const description = stringValue(record, ["description", "caption", "text"]);
  const author = stringValue(record, ["channelName", "ownerUsername", "username"]);
  const snippet = providerText([title, description, author].filter(Boolean).join("\n"),5000);
  if (!baseline && snippet.replace(/[^a-z0-9]/gi, "").length < 25) return null;
  return researchSourceSchema.parse({
    engagement:collectEngagement(record,'Apify'),
    creator:creatorFromUrl(String(record.channelUrl??record.channelURL??(typeof record.channelId==='string'?'https://www.youtube.com/channel/'+record.channelId:typeof record.ownerUsername==='string'?'https://www.instagram.com/'+record.ownerUsername+'/':'')))??undefined,
    providerSourceId: index + 1, title: providerText((title || `${platform} short video`).replace(/\s+/g, " "),300),
    url, snippet, publishedAt: dateValue(record.date ?? record.timestamp ?? record.takenAt ?? record.publishedAt),
    sourceType: platform === "YouTube" ? "youtube-shorts-native" : "instagram-reels-native",
  });
}

export async function startNativeDiscovery(input: { brief: ResearchBrief; requestedCount: number; seed?: string; round?: number }): Promise<NativeDiscoveryRun> {
  const queryPack = buildTikTokQueryPack(input.brief, input.seed, input.round);
  const payload = await apify(`/acts/${encodeURIComponent(TIKTOK_ACTOR)}/runs`, {
    method: "POST",
    body: JSON.stringify({
      searchQueries: queryPack,
      searchSection: "/video",
      resultsPerPage: input.brief.discoveryPilot?8:Math.min(15, Math.max(10, input.requestedCount)),
      videoSearchSorting: input.brief.discoveryFilters?.mode&&input.brief.discoveryFilters.mode!=='relevant'?"MOST_LIKED":"MOST_RELEVANT",
      videoSearchDateFilter: ({7:"PAST_WEEK",30:"PAST_MONTH",90:"LAST_3_MONTHS",180:"LAST_6_MONTHS"} as Record<number,string>)[input.brief.discoveryFilters?.maxAgeDays??0]??"ALL_TIME",
      scrapeRelatedSearchWords: false,
      scrapeRelatedVideos: false,
      scrapeAdditionalAuthorMeta: false,
      commentsPerPost: 0,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      aiVideoDescription: false,
      aiVideoSummary: false,
      proxyCountryCode: "US",
    }),
  });
  const run = asRecord(payload.data);
  if (!run || typeof run.id !== "string" || typeof run.status !== "string") throw new Error("APIFY_PROVIDER");
  return { id: run.id, status: run.status, platform: "TikTok", queryPack };
}

export async function startPlatformDiscovery(input: { brief: ResearchBrief; requestedCount: number; seed?: string; round?: number; platform: NativePlatform }): Promise<NativeDiscoveryRun> {
  if (input.platform === "TikTok") return startNativeDiscovery(input);
  const queryPack = input.platform === "Instagram" ? buildInstagramQueryPack(input.brief, input.seed, input.round) : buildCrossPlatformQueryPack(input.brief, input.seed, input.round);
  const actor = input.platform === "YouTube" ? YOUTUBE_ACTOR : INSTAGRAM_ACTOR;
  const actorInput = input.platform === "YouTube"
    ? { searchQueries: queryPack, maxResults: 0, maxResultsShorts: input.brief.discoveryPilot?8:Math.min(12, Math.max(8, input.requestedCount)), maxResultStreams: 0, transcriptionAndSubtitle: "NONE",...(input.brief.discoveryFilters?{sortingOrder:input.brief.discoveryFilters.mode==='relevant'?'relevance':'views',...(input.brief.discoveryFilters.maxAgeDays?{dateFilter:input.brief.discoveryFilters.maxAgeDays<=7?'week':input.brief.discoveryFilters.maxAgeDays<=30?'month':'year'}:{})}:{}) }
    : { search: queryPack.join(", "), searchType: "popular", searchLimit: input.brief.discoveryPilot?8:Math.min(12, Math.max(8, input.requestedCount)), liveSearch: false };
  const payload = await apify(`/acts/${encodeURIComponent(actor)}/runs`, { method: "POST", body: JSON.stringify(actorInput) });
  const run = asRecord(payload.data);
  if (!run || typeof run.id !== "string" || typeof run.status !== "string") throw new Error("APIFY_PROVIDER");
  return { id: run.id, status: run.status, platform: input.platform, queryPack };
}

export async function getNativeDiscoveryRun(runId: string, requestedCount: number, brief?: ResearchBrief, platform: NativePlatform = "TikTok",baseline=false): Promise<NativeDiscoveryResult> {
  const payload = await apify(`/actor-runs/${encodeURIComponent(runId)}`);
  const run = asRecord(payload.data);
  const status = typeof run?.status === "string" ? run.status : "UNKNOWN";
  const costUsd = typeof run?.usageTotalUsd === 'number' && Number.isFinite(run.usageTotalUsd) && run.usageTotalUsd >= 0 ? run.usageTotalUsd : null;
  if (activeStatuses.has(status)) return { state: "pending", status, costUsd };
  if (failedStatuses.has(status)) return { state: "failed", status, costUsd };
  if (status !== "SUCCEEDED" || typeof run?.defaultDatasetId !== "string") return { state: "failed", status, costUsd };

  const dataset = await apify(`/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?clean=true&format=json`);
  const items = Array.isArray(dataset) ? dataset : Array.isArray((dataset as Record<string, unknown>).data) ? (dataset as Record<string, unknown>).data as unknown[] : [];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  let invalidCount=0,formatRejectedCount=0,duplicateCount=0;
  for (const item of items) {
    const safetyProfile = !brief || /women.?s? safety|personal safety|situational awareness/i.test([...brief.sourceTopics, ...brief.contentPillars, ...brief.audienceInterests].join(' '));
    const parsed = platform === "TikTok" ? sourceFromTiktokItem(item, sources.length, !baseline&&safetyProfile,baseline)
      : sourceFromCrossPlatformItem(item, sources.length, platform,baseline);
    if (!parsed) {invalidCount++;continue;}
    if (seen.has(parsed.url)) {duplicateCount++;continue;}
    if (!baseline&&brief&&actionFormatRejection(brief,parsed)) {formatRejectedCount++;continue;}
    seen.add(parsed.url);
    sources.push(parsed);
    // Keep a larger local pool than the requested delivery count. The screener
    // needs room for duplicate removal and manual-review leads without turning
    // a Find 10 request into a three-result search.
    if (sources.length >= (baseline?10:brief?.discoveryPilot?40:Math.min(60, Math.max(requestedCount * 3, 30)))) break;
  }
  return { state: "completed", status, sources, costUsd,rawCount:items.length,invalidCount,formatRejectedCount,duplicateCount };
}

export async function startWatchlistDiscovery(brief:ResearchBrief,watchlist:Array<{platform:NativePlatform;url:string}>,baseline=false):Promise<{runs:NativeDiscoveryRun[];diagnostics:string[]}>{
 const runs=await Promise.allSettled((['TikTok','Instagram','YouTube'] as NativePlatform[]).map(async platform=>{
  const urls=watchlist.filter(x=>x.platform===platform).slice(0,20).map(x=>x.url);if(!urls.length)return null;
  const actor=platform==='TikTok'?TIKTOK_ACTOR:platform==='YouTube'?YOUTUBE_ACTOR:'apify~instagram-scraper';
  const input=platform==='TikTok'?{profiles:urls,resultsPerPage:baseline?10:5,profileSorting:'latest',excludePinnedPosts:true,shouldDownloadVideos:false,commentsPerPost:0}:platform==='YouTube'?{startUrls:urls.map(url=>({url})),maxResults:0,maxResultsShorts:baseline?10:5,sortVideosBy:'NEWEST',maxResultStreams:0,transcriptionAndSubtitle:'NONE'}:{directUrls:urls,resultsType:'posts',resultsLimit:baseline?10:5};
  const payload=await apify(`/acts/${encodeURIComponent(actor)}/runs`,{method:'POST',body:JSON.stringify(input)});const run=asRecord(payload.data);if(!run||typeof run.id!=='string'||typeof run.status!=='string')throw Error('WATCHLIST_PROVIDER');
  return {id:run.id,status:run.status,platform,queryPack:urls};
 }));
 return {runs:runs.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]),diagnostics:runs.flatMap((r,i)=>r.status==='rejected'?[`Watchlist ${(['TikTok','Instagram','YouTube'] as const)[i]} discovery unavailable`]:[])};
}
