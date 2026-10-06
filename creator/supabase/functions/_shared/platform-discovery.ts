import { canonicalResearchUrl, researchSourceSchema, type ResearchBrief, type ResearchSource } from "../../../src/domain/research.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const APIFY_API = "https://api.apify.com/v2";
const TIKTOK_ACTOR = "clockworks~tiktok-scraper";
const activeStatuses = new Set(["READY", "RUNNING"]);
const failedStatuses = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

export type NativeDiscoveryRun = {
  id: string;
  status: string;
  platform: "TikTok";
  queryPack: string[];
};

export type NativeDiscoveryResult =
  | { state: "pending"; status: string }
  | { state: "failed"; status: string }
  | { state: "completed"; status: string; sources: ResearchSource[] };

function apifyToken(): string {
  const token = Deno.env.get("CREATOR_APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_NOT_CONFIGURED");
  return token;
}

async function apify(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${APIFY_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apifyToken()}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") throw new Error("APIFY_PROVIDER");
  return payload as Record<string, unknown>;
}

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 4);
}

/**
 * These scenarios are intentionally concrete. Generic safety searches surface news
 * coverage and reaction videos; scenario language surfaces the original footage
 * types Steve can teach from.
 */
export function buildTikTokQueryPack(brief: ResearchBrief): string[] {
  const defaults = [
    "woman followed parking lot security camera",
    "store employee walks woman to car safety",
    "woman followed in store staff helps",
    "doorbell camera stranger approaches driveway woman",
    "security guard removes aggressive man from store",
    "woman being followed gets help original video",
  ];
  const profileTerms = [...brief.sourceTopics, ...brief.audienceProblems, ...brief.contentPillars]
    .flatMap(words)
    .filter((word) => !["women", "woman", "safety", "security", "situational", "awareness"].includes(word));
  const profileQuery = profileTerms.slice(0, 4).join(" ");
  const combined = profileQuery ? [`${profileQuery} safety footage`, ...defaults] : defaults;
  return [...new Set(combined)].slice(0, 3);
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
  if (/\b(horrortok|creepypasta|analog horror|found footage|scarytok|scary story|paranormal|supernatural|haunted|fiction(?:al)?|fake)\b/.test(normalized)) return "fiction";
  if (/\b(abc news|cbs news|fox news|inside edition|good morning america|gma|tmz|breaking news|newsner)\b/.test(normalized)) return "news";
  if (/\b(storytime|reenactment|re enactment|skit|prank|compilation|shorts)\b/.test(normalized)) return "format";
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

function sourceFromTiktokItem(item: unknown, index: number): ResearchSource | null {
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
  if (automaticTikTokRejectReason([description, subtitles, authorName].filter(Boolean).join("\n"))) return null;
  const snippet = [description, subtitles].filter(Boolean).join("\n").slice(0, 5000);
  const title = (description || `TikTok video from ${authorName || "creator"}`).replace(/\s+/g, " ").trim().slice(0, 300);
  return researchSourceSchema.parse({
    providerSourceId: index + 1,
    title: title || "TikTok safety-video lead",
    url: direct,
    snippet,
    publishedAt: dateValue(record.createTime ?? record.createTimeISO ?? record.timestamp),
    sourceType: "tiktok-native",
  });
}

export async function startNativeDiscovery(input: { brief: ResearchBrief; requestedCount: number }): Promise<NativeDiscoveryRun> {
  const queryPack = buildTikTokQueryPack(input.brief);
  const payload = await apify(`/acts/${encodeURIComponent(TIKTOK_ACTOR)}/runs`, {
    method: "POST",
    body: JSON.stringify({
      searchQueries: queryPack,
      searchSection: "/video",
      resultsPerPage: Math.min(12, Math.max(8, input.requestedCount)),
      videoSearchSorting: "MOST_RELEVANT",
      videoSearchDateFilter: "ALL_TIME",
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

export async function getNativeDiscoveryRun(runId: string, requestedCount: number): Promise<NativeDiscoveryResult> {
  const payload = await apify(`/actor-runs/${encodeURIComponent(runId)}`);
  const run = asRecord(payload.data);
  const status = typeof run?.status === "string" ? run.status : "UNKNOWN";
  if (activeStatuses.has(status)) return { state: "pending", status };
  if (failedStatuses.has(status)) return { state: "failed", status };
  if (status !== "SUCCEEDED" || typeof run?.defaultDatasetId !== "string") return { state: "failed", status };

  const dataset = await apify(`/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?clean=true&format=json`);
  const items = Array.isArray(dataset) ? dataset : Array.isArray((dataset as Record<string, unknown>).data) ? (dataset as Record<string, unknown>).data as unknown[] : [];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const item of items) {
    const parsed = sourceFromTiktokItem(item, sources.length);
    if (!parsed || seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    sources.push(parsed);
    if (sources.length >= Math.min(30, Math.max(requestedCount * 2, 12))) break;
  }
  return { state: "completed", status, sources };
}
