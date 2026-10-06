import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Check, ExternalLink, Lightbulb, LoaderCircle, Plus, ThumbsDown, WandSparkles } from "lucide-react";
import type { ContentProfile } from "../domain/strategy";
import {
  loadResearchFeed, refineResearchOpportunity, requestResearch, researchFeedback, syncResearch,
  type ResearchFeed, type ResearchOpportunity,
} from "../lib/research-client";
import "./discover.css";

const activeStatuses = new Set(["queued", "researching", "reviewing_sources", "ranking"]);
const rejectReasons = [
  ["not_relevant", "Not relevant"], ["already_talked_about_this", "Already talked about this"],
  ["dont_like_this_topic", "Don’t like this topic"], ["too_old", "Too old"],
  ["not_my_audience", "Not my audience"], ["wrong_angle", "Wrong angle"], ["other", "Other"],
] as const;

export function Discover({ profiles, selectedId, onCreate }: { profiles: ContentProfile[]; selectedId: string | null; onCreate: (opportunity: ResearchOpportunity) => void }) {
  const profile = profiles.find((item) => item.id === selectedId && !item.archived_at) ?? profiles.find((item) => !item.archived_at) ?? null;
  const [feed, setFeed] = useState<ResearchFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("not_relevant");
  const [refining, setRefining] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");

  const load = useCallback(async () => {
    const next = await loadResearchFeed(profile?.id);
    setFeed(next);
    return next;
  }, [profile?.id]);
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
  const visible = feed?.opportunities.filter((opportunity) => opportunity.status !== "rejected") ?? [];

  return <section className="discover" aria-labelledby="discover-heading">
    <header className="discover-header">
      <div>
        <span className="eyebrow">PERSONALIZED CONTENT OPPORTUNITIES</span>
        <h1 id="discover-heading">Things your audience may want to hear from you about.</h1>
        <p>{profile ? `Based on ${profile.name}, your audience, and what you’ve responded to before.` : "Choose an audience profile to begin."}</p>
      </div>
      <div className="discover-allowance" aria-label="Research allowance">
        <strong>{feed?.remaining ?? "—"}</strong><span>opportunities remaining</span>
      </div>
    </header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {!feed?.active ? <div className="discover-empty"><Lightbulb size={28}/><h2>Discover is coming to your workspace.</h2><p>This personalized research feature is available to selected Pro pilot accounts.</p></div> : <>
      <section className="discover-find" aria-label="Find new opportunities"><div><strong>Find fresh opportunities</strong><span>Research a whole batch when you’re ready to plan content.</span></div><div className="discover-batches">{([10, 20, 30] as const).map((count) => <button key={count} className="button" disabled={busy || !profile || (feed?.remaining ?? 0) < count} onClick={() => void find(count)}><Plus size={16}/> Find {count}</button>)}</div></section>
      {activeJobs.map((job) => <div className="research-progress" key={job.id} role="status"><LoaderCircle className="spin" size={19}/><div><strong>{job.phase}</strong><span>We’re looking for source-backed opportunities. You can leave and come back—this will keep its place.</span></div></div>)}
      {!activeJobs.length && !visible.length && <div className="discover-empty"><Lightbulb size={28}/><h2>Your opportunity feed starts here.</h2><p>Choose a batch when you’re ready. Vektiss will look for timely conversations where your perspective can add something useful.</p></div>}
      <div className="opportunity-list">{visible.map((opportunity) => <article className="opportunity-card" key={opportunity.id}>
        <div className="opportunity-meta"><span>{opportunity.category}</span>{opportunity.published_at && <time dateTime={opportunity.published_at}>{new Date(opportunity.published_at).toLocaleDateString()}</time>}<small>Relevance {Math.round(opportunity.relevance_score)}%</small></div>
        <h2>{opportunity.title}</h2><p className="opportunity-summary">{opportunity.factual_summary}</p>
        <dl><div><dt>Why your audience cares</dt><dd>{opportunity.why_audience_cares}</dd></div><div><dt>Your credible angle</dt><dd>{opportunity.creator_connection}</dd></div><div><dt>Recommended angle</dt><dd>{opportunity.recommended_angle}</dd></div>{opportunity.suggested_hook && <div><dt>Suggested hook</dt><dd>{opportunity.suggested_hook}</dd></div>}</dl>
        {opportunity.uncertainty && <p className="opportunity-uncertainty"><strong>Source note:</strong> {opportunity.uncertainty}</p>}
        <div className="opportunity-sources"><strong>Sources</strong>{opportunity.source_snapshot.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}<ExternalLink size={13}/></a>)}</div>
        {refining === opportunity.id && <div className="opportunity-refine"><label>How should Vektiss change the angle?<input value={instruction} maxLength={1000} placeholder="e.g. Make this more relevant to homebuyers" onChange={(event) => setInstruction(event.target.value)}/></label><button disabled={busy || !instruction.trim()} onClick={() => void action(async () => { await refineResearchOpportunity(opportunity.id, instruction); setInstruction(""); setRefining(null); })}>Update angle</button><button disabled={busy} onClick={() => { setRefining(null); setInstruction(""); }}>Cancel</button></div>}
        {rejecting === opportunity.id && <div className="opportunity-reject"><label>Why isn’t this for you?<select value={reason} onChange={(event) => setReason(event.target.value)}>{rejectReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "rejected", reason); setRejecting(null); })}>Confirm</button><button disabled={busy} onClick={() => setRejecting(null)}>Cancel</button></div>}
        <footer><button className="opportunity-save" disabled={busy || opportunity.status === "saved"} onClick={() => void action(() => researchFeedback(opportunity.id, "saved"))}><Bookmark size={16}/>{opportunity.status === "saved" ? "Saved" : "Save"}</button><button disabled={busy} onClick={() => { setRejecting(opportunity.id); setRefining(null); }}><ThumbsDown size={16}/> Not for me</button><button disabled={busy} onClick={() => { setRefining(opportunity.id); setRejecting(null); }}><WandSparkles size={16}/> Change angle</button><button className="button primary" disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "selected"); onCreate(opportunity); })}><Check size={16}/> Create</button></footer>
      </article>)}</div>
    </>}
  </section>;
}
