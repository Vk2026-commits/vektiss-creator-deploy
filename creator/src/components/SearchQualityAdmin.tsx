import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { defaultSearchQuality, type SearchQualitySettings } from "../domain/search-quality";
import "./search-quality-admin.css";

type Profile = { id: string; user_id: string; name: string; creator_name?: string; primary_audience: string; archived_at: string | null; strategy?: Record<string, unknown> };
type Job = { id: string; status: string; requested_count: number; delivered_count: number; candidate_count: number; phase: string; provider_metadata: Record<string, unknown>; created_at: string };
type Idea = { id: string; title: string; category: string; relevance_score: number; status: string; job_id: string; source_snapshot: Array<{ url: string; sourceType: string }>; created_at: string };
type Detail = { profile: Profile; version: number; settings: SearchQualitySettings; history: Array<{ version: number; created_at: string }>; jobs: Job[]; opportunities: Idea[]; feedback: Array<{ opportunity_id: string; reason: string; created_at: string }> };

async function call<T>(body: unknown): Promise<T> {
  if (!supabase) throw Error("Sign in to use Search Quality.");
  const { data, error } = await supabase.functions.invoke("search-quality-admin", { body: body as Record<string, unknown> });
  if (error || data?.code) throw Error(data?.code === "VERSION_CONFLICT" ? "These settings changed elsewhere. Refresh before saving." : data?.code ?? "Search Quality could not load.");
  return data as T;
}
const lines = (value: string) => value.split("\n").map(line => line.trim()).filter(Boolean);
const platformName = (sourceType: string) => sourceType.includes("instagram") ? "Instagram" : sourceType.includes("youtube") ? "YouTube" : sourceType.includes("tiktok") ? "TikTok" : "Other";

export function SearchQualityAdmin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<SearchQualitySettings>(defaultSearchQuality);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const loadList = useCallback(async (page: number) => {
    const result = await call<{ profiles: Profile[]; total: number }>({ action: "list", offset: page });
    setProfiles(result.profiles); setTotal(result.total);
    setSelected(current => result.profiles.some(profile => profile.id === current) ? current : result.profiles[0]?.id || "");
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    const result = await call<Detail>({ action: "detail", profileId: id });
    setDetail(result); setForm(result.settings);
  }, []);
  useEffect(() => { void loadList(offset).catch(e => setError(String(e.message))); }, [offset, loadList]);
  useEffect(() => { void loadDetail(selected).catch(e => setError(String(e.message))); }, [selected, loadDetail]);
  const feedbackById = useMemo(() => { const latest = new Map<string, string>(); for (const row of detail?.feedback ?? []) if (!latest.has(row.opportunity_id)) latest.set(row.opportunity_id, row.reason); return latest; }, [detail]);
  const reasonCounts = useMemo(() => { const counts = new Map<string, number>(); for (const reason of feedbackById.values()) if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1); return [...counts.entries()].sort((a, b) => b[1] - a[1]); }, [feedbackById]);
  async function save(action: "save" | "rollback", restoreVersion?: number) {
    if (!detail || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (action === "save") await call({ action, profileId: selected, expectedVersion: detail.version, settings: form });
      else await call({ action, profileId: selected, expectedVersion: detail.version, restoreVersion });
      await loadDetail(selected);
      setNotice(action === "save" ? "Search rules saved. They apply to future searches only." : "Earlier rules restored as a new version.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save."); }
    finally { setBusy(false); }
  }
  function field<K extends keyof SearchQualitySettings>(key: K, value: SearchQualitySettings[K]) { setForm(current => ({ ...current, [key]: value })); }
  async function reject(idea: Idea) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await call({ action: "reject", profileId: selected, opportunityId: idea.id, reason: rejectReasons[idea.id] ?? "off_topic" });
      await loadDetail(selected);
      setNotice("Marked as a poor match. This profile’s future searches will use the feedback.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not mark the clip."); }
    finally { setBusy(false); }
  }
  return <section className="search-quality-admin">
    <header><span className="eyebrow">OWNER STUDIO / DISCOVER</span><h1>Search Quality</h1><p>Tune what Discover looks for, then see what it actually found. Changes here never start a paid search.</p></header>
    {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="quality-notice">{notice}</p>}
    <div className="quality-selector"><label>Creator and Content Profile<select value={selected} onChange={e => setSelected(e.target.value)}>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.creator_name ?? "Creator"} / {profile.name}{profile.archived_at ? " (archived)" : ""}</option>)}</select></label><div><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>{total ? `${offset + 1}–${Math.min(offset + 50, total)} of ${total}` : "No profiles"}</span><button disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Next</button></div></div>
    {detail && <><div className="quality-context"><strong>Editing: {detail.profile.name}</strong><span>{detail.profile.primary_audience}</span><small>Creator account {detail.profile.user_id} · Rule version {detail.version || "not yet customized"}</small><details><summary>Existing Content Profile topics</summary><p>Source topics: {Array.isArray(detail.profile.strategy?.source_topics) ? detail.profile.strategy.source_topics.join(" · ") : "Not set"}</p><p>Content pillars: {Array.isArray(detail.profile.strategy?.content_pillars) ? detail.profile.strategy.content_pillars.join(" · ") : "Not set"}</p></details></div>
      <div className="quality-grid"><section className="quality-card"><h2>What makes a strong match?</h2><p>These rules apply only to this Content Profile. Existing ideas stay as they are.</p>
        <label>Situations to seek<textarea value={form.seekSituations} onChange={e => field("seekSituations", e.target.value)} placeholder="Real situations this creator can explain or react to" /></label>
        <label>Topics or formats to avoid<textarea value={form.avoidTopics} onChange={e => field("avoidTopics", e.target.value)} placeholder="Unrelated topics, staged clips, news packaging…" /></label>
        <label>Other screening criteria<textarea value={form.screeningCriteria} onChange={e => field("screeningCriteria", e.target.value)} /></label>
        <fieldset><legend>Platforms to search</legend>{(["TikTok", "Instagram", "YouTube"] as const).map(platform => <label key={platform}><input type="checkbox" checked={form.platforms.includes(platform)} onChange={e => field("platforms", e.target.checked ? [...form.platforms, platform] : form.platforms.filter(item => item !== platform))} />{platform}</label>)}</fieldset>
        <label>Good clip examples (one public link per line)<textarea value={form.goodExamples.join("\n")} onChange={e => field("goodExamples", lines(e.target.value))} /></label>
        <label>Bad clip examples (one link per line; these links are blocked)<textarea value={form.badExamples.join("\n")} onChange={e => field("badExamples", lines(e.target.value))} /></label>
        <button className="button primary" disabled={busy || !form.platforms.length || form.goodExamples.length > 10 || form.badExamples.length > 10} onClick={() => void save("save")}>{busy ? "Saving…" : "Save search rules"}</button>
        <details><summary>Version history and rollback</summary>{detail.history.length ? detail.history.map(item => <div className="quality-history" key={item.version}><span>Version {item.version} · {new Date(item.created_at).toLocaleString()}</span><button disabled={busy || item.version === detail.version} onClick={() => void save("rollback", item.version)}>Restore</button></div>) : <p>No changes yet.</p>}</details>
      </section><section className="quality-card"><h2>Recent search quality</h2><p>A request for ten is a goal, not a promise to show weak clips.</p>
        {detail.jobs.map(job => { const rounds = Array.isArray(job.provider_metadata?.roundReports) ? job.provider_metadata.roundReports as Array<Record<string, unknown>> : []; return <details key={job.id}><summary>{new Date(job.created_at).toLocaleDateString()} · {job.delivered_count}/{job.requested_count} delivered · {job.status}</summary><p>{job.candidate_count} candidates reviewed; {Math.max(0, job.candidate_count - job.delivered_count)} not delivered. {job.phase}</p>{rounds.map((round, index) => { const byPlatform = round.acceptedByPlatform && typeof round.acceptedByPlatform === "object" ? round.acceptedByPlatform as Record<string, number> : {}; return <p key={index}>Round {index + 1}: {Number(round.freshSourceCount ?? 0)} fresh clips · {Number(round.screenedCandidateCount ?? 0)} screened · {Number(round.acceptedCount ?? 0)} strong matches so far · TikTok {byPlatform.TikTok ?? 0}, Instagram {byPlatform.Instagram ?? 0}, YouTube {byPlatform.YouTube ?? 0}.</p>; })}</details>; })}
        {!detail.jobs.length && <p>No searches for this profile yet.</p>}
        <h3>Recent results and feedback</h3><p>{reasonCounts.length ? reasonCounts.map(([reason, count]) => `${reason.replaceAll("_", " ")}: ${count}`).join(" · ") : "No recent rejection reasons."}</p><div className="quality-results">{detail.opportunities.map(idea => <article key={idea.id}><strong>{idea.title}</strong><span>{platformName(idea.source_snapshot[0]?.sourceType ?? "")} · Match {Math.round(idea.relevance_score)}% · {idea.status}{feedbackById.get(idea.id) ? ` · ${feedbackById.get(idea.id)}` : ""}</span>{idea.source_snapshot[0]?.url && <a href={idea.source_snapshot[0].url} target="_blank" rel="noreferrer">Open clip</a>}{!(["selected", "turned_into_content"].includes(idea.status)) && <div className="quality-reject"><label>Why is this a poor match?<select value={rejectReasons[idea.id] ?? "off_topic"} onChange={event => setRejectReasons(current => ({ ...current, [idea.id]: event.target.value }))}>{[["off_topic","Off-topic"],["staged","Staged or fictional"],["duplicate","Duplicate"],["unavailable","Unavailable or sign-in required"],["poor_quality","Poor video quality"],["not_relevant","Not relevant"],["wrong_angle","Wrong angle"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><button disabled={busy} onClick={() => void reject(idea)}>Mark bad match</button></div>}</article>)}</div>
      </section></div></>}
  </section>;
}
