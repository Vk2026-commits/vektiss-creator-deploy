import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Eye, Lightbulb,
  LoaderCircle, Plus, ShieldCheck, Sparkles, ThumbsDown, WandSparkles,
} from "lucide-react";
import type { ContentProfile } from "../domain/strategy";
import {
  loadResearchFeed, refineResearchOpportunity, requestResearch, researchFeedback, syncResearch,
  type ResearchFeed, type ResearchFeedFilter, type ResearchOpportunity,
} from "../lib/research-client";
import "./discover.css";

const activeStatuses = new Set(["queued", "researching", "reviewing_sources", "ranking"]);
const rejectReasons = [
  ["not_relevant", "Not relevant"], ["already_talked_about_this", "Already talked about this"],
  ["dont_like_this_topic", "Don’t like this topic"], ["too_old", "Too old"],
  ["not_my_audience", "Not my audience"], ["wrong_angle", "Wrong angle"], ["other", "Other"],
] as const;
const historyFilters = [
  ["all", "All"], ["saved", "Saved"], ["used", "Used"], ["skipped", "Skipped"],
] as const;
type HistoryFilter = ResearchFeedFilter;
const archivePageSize = 8;

type EmbeddedClip = { platform: "TikTok" | "Instagram" | "YouTube"; src: string };

function embeddedClip(url: string): EmbeddedClip | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("tiktok.com")) {
      const videoId = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
      return videoId ? { platform: "TikTok", src: `https://www.tiktok.com/player/v1/${videoId}` } : null;
    }
    if (host.includes("instagram.com")) {
      const shortcode = parsed.pathname.match(/\/(?:reel|reels)\/([^/?#]+)/)?.[1];
      return shortcode ? { platform: "Instagram", src: `https://www.instagram.com/reel/${shortcode}/embed/captioned/` } : null;
    }
    if (host.includes("youtube.com") || host === "youtu.be") {
      const videoId = host === "youtu.be" ? parsed.pathname.split("/").filter(Boolean)[0] : parsed.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)?.[1] ?? parsed.searchParams.get("v");
      return videoId ? { platform: "YouTube", src: `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0` } : null;
    }
  } catch { /* Source remains available as an external fallback. */ }
  return null;
}

export function Discover({ profiles, selectedId, onCreate }: { profiles: ContentProfile[]; selectedId: string | null; onCreate: (opportunity: ResearchOpportunity) => void }) {
  const profile = profiles.find((item) => item.id === selectedId && !item.archived_at) ?? profiles.find((item) => !item.archived_at) ?? null;
  const [feed, setFeed] = useState<ResearchFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("not_relevant");
  const [refining, setRefining] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [pageOffset, setPageOffset] = useState(0);

  const load = useCallback(async () => {
    const next = await loadResearchFeed(profile?.id, { filter: historyFilter, offset: pageOffset, limit: archivePageSize });
    setFeed(next);
    if (!next.opportunities.length && next.opportunityTotal > 0 && pageOffset >= next.opportunityTotal) {
      setPageOffset(Math.max(0, Math.floor((next.opportunityTotal - 1) / archivePageSize) * archivePageSize));
    }
    return next;
  }, [historyFilter, pageOffset, profile?.id]);
  useEffect(() => { setPageOffset(0); }, [profile?.id]);
  useEffect(() => { void load().catch(() => setError("Discover could not load. Refresh to retry.")); }, [load]);
  const activeJobs = useMemo(() => feed?.jobs.filter((job) => activeStatuses.has(job.status)) ?? [], [feed]);
  useEffect(() => {
    if (!activeJobs.length) return;
    const timer = window.setInterval(() => {
      void Promise.all(activeJobs.map((job) => syncResearch(job.id).catch(() => null))).then(() => load().catch(() => undefined));
    }, 6000);
    return () => window.clearInterval(timer);
  }, [activeJobs, load]);

  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await work(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Discover could not complete that action."); }
    finally { setBusy(false); }
  }
  async function find(count: 10 | 20 | 30) {
    if (!profile) { setError("Create a content profile before researching."); return; }
    await action(async () => { await requestResearch(profile.id, count); });
  }
  const visible = feed?.opportunities ?? [];
  const filterCount = (filter: HistoryFilter) => feed?.statusCounts?.[filter] ?? 0;
  const currentPage = Math.floor(pageOffset / archivePageSize) + 1;
  const totalPages = Math.max(1, Math.ceil((feed?.opportunityTotal ?? 0) / archivePageSize));
  const hasPreviousPage = pageOffset > 0;
  const hasNextPage = pageOffset + archivePageSize < (feed?.opportunityTotal ?? 0);
  const emptyTitle: Record<HistoryFilter, string> = { all: "Your ideas will show up here.", saved: "No saved ideas yet.", used: "No used ideas yet.", skipped: "Nothing has been skipped yet." };
  const emptyText: Record<HistoryFilter, string> = { all: "Pick a number above. We’ll do the searching.", saved: "Tap the bookmark on an idea you want to keep.", used: "Choose Use idea to turn a result into a video.", skipped: "Ideas you skip will stay here, out of your main feed." };

  return <section className="discover" aria-labelledby="discover-heading">
    <header className="discover-header">
      <div>
        <span className="eyebrow">DISCOVER</span>
        <h1 id="discover-heading">Your next video idea.</h1>
        <p>{profile ? `Quick picks made for ${profile.name}.` : "Pick a profile to see your ideas."}</p>
      </div>
      <div className="discover-allowance" aria-label="Research allowance">
        <strong>{feed?.remaining ?? "—"}</strong><span>ideas left</span>
      </div>
    </header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {!feed?.active ? <div className="discover-empty"><Lightbulb size={28}/><h2>Discover is almost ready.</h2><p>This feature is available to selected Pro pilot accounts.</p></div> : <>
      <section className="discover-find" aria-label="Find new opportunities"><div><strong>Get new ideas</strong><span>We’ll look for clips you can react to.</span></div><div className="discover-batches">{([10, 20, 30] as const).map((count) => <button key={count} className="button" disabled={busy || !profile || (feed?.remaining ?? 0) < count} onClick={() => void find(count)}><Plus size={16}/> Find {count}</button>)}</div></section>
      <nav className="discover-filters" aria-label="Idea history">{historyFilters.map(([filter, label]) => <button key={filter} className={historyFilter === filter ? "active" : ""} aria-pressed={historyFilter === filter} onClick={() => { setHistoryFilter(filter); setPageOffset(0); }}>{label}<span>{filterCount(filter)}</span></button>)}</nav>
      {activeJobs.map((job) => <div className="research-progress" key={job.id} role="status"><LoaderCircle className="spin" size={19}/><div><strong>Finding your clips</strong><span>{job.phase}</span></div></div>)}
      {!activeJobs.length && !visible.length && <div className="discover-empty"><Lightbulb size={28}/><h2>{emptyTitle[historyFilter]}</h2><p>{emptyText[historyFilter]}</p></div>}
      <div className="opportunity-list">{visible.map((opportunity) => {
        const source = opportunity.source_snapshot[0];
        const embed = source ? embeddedClip(source.url) : null;
        const needsCheck = Boolean(opportunity.uncertainty);
        return <article className="opportunity-card" key={opportunity.id}>
          <div className="signal-rail" aria-hidden="true" />
          <div className={`opportunity-layout${embed ? " has-inline-clip" : ""}`}>
            {embed && <InlineClip embed={embed} title={opportunity.title} sourceUrl={source.url} />}
            <div className="opportunity-content">
              <div className="opportunity-meta">
                <span className="signal-category">{opportunity.category}</span>
                <span className={needsCheck ? "signal-status signal-status-check" : "signal-status"}>{needsCheck ? <><Eye size={14}/> Watch first</> : <><ShieldCheck size={14}/> Ready to use</>}</span>
                <small>Match {Math.round(opportunity.relevance_score)}%</small>
              </div>
              <div className="signal-main">
                <div>
                  <h2>{opportunity.title}</h2>
                  <p className="opportunity-summary">{opportunity.factual_summary}</p>
                </div>
                <div className="signal-score" aria-label={`${Math.round(opportunity.relevance_score)} percent match`}><strong>{Math.round(opportunity.relevance_score)}</strong><span>match</span></div>
              </div>
              <div className="signal-take">
                <span><Sparkles size={15}/> YOUR SIMPLE TAKE</span>
                <p>{opportunity.recommended_angle}</p>
              </div>
              <div className="signal-points">
                <div><span>WHY IT WORKS</span><p>{opportunity.creator_connection}</p></div>
                {opportunity.suggested_hook && <div><span>OPEN WITH THIS</span><p>{opportunity.suggested_hook}</p></div>}
              </div>
              {needsCheck && <details className="signal-proof"><summary><span><Eye size={15}/> Quick check before you use this</span><ChevronDown size={16}/></summary><p>{opportunity.uncertainty}</p>{source && <a className="proof-source" href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open source</a>}</details>}
              <footer>
                <div className="opportunity-actions">
                  <button className={`icon-action${opportunity.status === "saved" ? " is-saved" : ""}`} aria-label={opportunity.status === "saved" ? "Idea saved" : "Save idea"} title={opportunity.status === "saved" ? "Saved" : "Save idea"} disabled={busy || opportunity.status === "saved"} onClick={() => void action(() => researchFeedback(opportunity.id, "saved"))}><Bookmark size={17}/></button>
                  <button className="icon-action" aria-label="Skip idea" title="Skip idea" disabled={busy} onClick={() => { setRejecting(opportunity.id); setRefining(null); }}><ThumbsDown size={17}/></button>
                  <button className="icon-action" aria-label="Change the idea" title="Change the idea" disabled={busy} onClick={() => { setRefining(opportunity.id); setRejecting(null); }}><WandSparkles size={17}/></button>
                  <button className="button primary use-idea" disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "selected"); onCreate(opportunity); })}><Clapperboard size={17}/> Use idea<Check size={15}/></button>
                </div>
              </footer>
            </div>
          </div>
          {refining === opportunity.id && <div className="opportunity-refine"><label>How should we change it?<input value={instruction} maxLength={1000} placeholder="Make it more helpful for my audience" onChange={(event) => setInstruction(event.target.value)}/></label><button className="button primary" disabled={busy || !instruction.trim()} onClick={() => void action(async () => { await refineResearchOpportunity(opportunity.id, instruction); setInstruction(""); setRefining(null); })}>Update</button><button disabled={busy} onClick={() => { setRefining(null); setInstruction(""); }}>Cancel</button></div>}
          {rejecting === opportunity.id && <div className="opportunity-reject"><label>Why are you skipping it?<select value={reason} onChange={(event) => setReason(event.target.value)}>{rejectReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button primary" disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "rejected", reason); setRejecting(null); })}>Skip it</button><button disabled={busy} onClick={() => setRejecting(null)}>Cancel</button></div>}
        </article>;
      })}</div>
      {feed && feed.opportunityTotal > 0 && <nav className="archive-pagination" aria-label="Idea archive pages"><button disabled={busy || !hasPreviousPage} onClick={() => setPageOffset(Math.max(0, pageOffset - archivePageSize))}><ChevronLeft size={17}/>Previous</button><span aria-live="polite">Page {currentPage} of {totalPages}<small>{feed.opportunityTotal} ideas</small></span><button disabled={busy || !hasNextPage} onClick={() => setPageOffset(pageOffset + archivePageSize)}>Next<ChevronRight size={17}/></button></nav>}
    </>}
  </section>;
}

function InlineClip({ embed, title, sourceUrl }: { embed: EmbeddedClip; title: string; sourceUrl: string }) {
  return <aside className="inline-clip">
    <div className="inline-clip-header"><span>{embed.platform} clip</span><a href={sourceUrl} target="_blank" rel="noreferrer" aria-label="Open the original post" title="Open original post"><ExternalLink size={14}/></a></div>
    <iframe src={embed.src} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
  </aside>;
}
