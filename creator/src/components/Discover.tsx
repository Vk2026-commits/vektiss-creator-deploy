import {deliveryProgress} from '../domain/search-delivery';
import {searchKeywords} from '../domain/search-keywords';
import {DiscoverFilters} from './DiscoverFilters';
import {discoveryFiltersSchema,type DiscoveryFilters} from '../domain/discovery-engagement';
import {DiscoveryPilotControls} from './DiscoveryPilotControls';
import {creatorFromUrl,reviewLabel,needsSourceCheck} from '../domain/discovery-pilot';
import {discoverySettings} from '../lib/research-client';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Eye, Lightbulb,
  LoaderCircle, ShieldCheck, Sparkles, ThumbsDown, WandSparkles,
} from "lucide-react";
import type { ContentProfile } from "../domain/strategy";
import {
  resumeResearch, loadResearchFeed, refineResearchOpportunity, requestResearch, researchFeedback, syncResearch, stopResearch,
  type ResearchFeed, type ResearchFeedFilter, type ResearchOpportunity,
} from "../lib/research-client";
import "./discover.css";
import {researchSortLabels,type ResearchSort} from '../domain/research-sort';
import {resolveArticleWindow,localDate,type ArticleDate} from '../domain/research-window';

const activeStatuses = new Set(["queued", "researching", "reviewing_sources", "ranking"]);
const rejectReasons = [
  ["not_relevant", "Not relevant"], ["already_talked_about_this", "Already talked about this"],
  ["off_topic", "Off-topic"], ["staged", "Staged or fictional"], ["duplicate", "Duplicate clip"],
  ["unavailable", "Unavailable or sign-in required"], ["poor_quality", "Poor video quality"],
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

export function Discover({ profiles, selectedId, onSelectProfile, onCreate }: { profiles: ContentProfile[]; selectedId: string | null; onSelectProfile: (id: string) => void; onCreate: (opportunity: ResearchOpportunity, mode: "reaction" | "original") => void }) {
  const activeProfiles = profiles.filter(item => !item.archived_at);
  const profile = activeProfiles.find(item => item.id === selectedId) ?? activeProfiles[0] ?? null;
  const [filters,setFilters]=useState<DiscoveryFilters>(()=>{try{return discoveryFiltersSchema.parse(JSON.parse(localStorage.getItem('creator-search-filters-v2:'+profile?.id)??'{"mode":"relevant","minViews":0,"minEngagementRate":0,"maxAgeDays":0}'));}catch{return discoveryFiltersSchema.parse({mode:'relevant',minViews:0,minEngagementRate:0,maxAgeDays:0});}});
  function updateFilters(next:DiscoveryFilters){if(next.platform!==filters.platform)setFeed(null);setFilters(next);setPageOffset(0);setSort(next.mode==='outliers'?'outlier':next.mode==='engaged'?'views':'recommended');try{localStorage.setItem('creator-search-filters-v2:'+profile?.id,JSON.stringify(next));}catch{/* Preferences remain available for this session. */}}
  const [feed, setFeed] = useState<ResearchFeed | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchCount, setSearchCount] = useState(10);
  const [stopConfirm,setStopConfirm]=useState<string|null>(null);
  const [stopping,setStopping]=useState<string|null>(null);
  const [watchRevision,setWatchRevision]=useState(0);
  const [notice,setNotice]=useState('');
  const stopLock=useRef(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("not_relevant");
  const [refining, setRefining] = useState<string | null>(null);
  const [searchQuery,setSearchQuery]=useState('');
  const [keywordDraft,setKeywordDraft]=useState('');
  const effectiveQuery=searchKeywords([searchQuery,keywordDraft].join(',')).join(', ');
  function addKeyword(){if(searchKeywords(effectiveQuery).length>5||effectiveQuery.length>300){setError('Use up to five phrases, totaling 300 characters.');return;}setSearchQuery(effectiveQuery);setKeywordDraft('');}
  const [useContentProfile,setUseContentProfile]=useState(true);
  const [instruction, setInstruction] = useState("");
  const [sourceMode,setSourceMode]=useState<'all'|'videos'|'articles'>('videos');
  const [sort,setSort]=useState<ResearchSort>('recommended');
  const [articleDate,setArticleDate]=useState<ArticleDate>({preset:'week',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [pageOffset, setPageOffset] = useState(0);
  const discoverRef = useRef<HTMLElement>(null);

  const [clockNow,setClockNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClockNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  const loadVersion=useRef(0);
  const load = useCallback(async () => {
    const version=++loadVersion.current;
    const next = await loadResearchFeed(profile?.id, { platform:sourceMode==='articles'?'all':filters.platform,filter: historyFilter, sourceMode, sort, offset: pageOffset, limit: archivePageSize });
    if(version!==loadVersion.current)return next;
    setFeed(next);
    if (!next.opportunities.length && next.opportunityTotal > 0 && pageOffset >= next.opportunityTotal) {
      setPageOffset(Math.max(0, Math.floor((next.opportunityTotal - 1) / archivePageSize) * archivePageSize));
    }
    return next;
  }, [historyFilter, pageOffset, profile?.id, sourceMode, sort,filters.platform]);
  useEffect(() => { setPageOffset(0); }, [profile?.id]);
  useEffect(() => { void load().catch(() => setError("Discover could not load. Refresh to retry.")); }, [load]);
  const activeJobs = useMemo(() => feed?.jobs.filter((job) => job.content_profile_id===profile?.id&&activeStatuses.has(job.status)) ?? [], [feed,profile?.id]);
  useEffect(()=>{
    if(!busy)return;
    const timer=window.setInterval(()=>void load().catch(()=>undefined),2000);
    return ()=>window.clearInterval(timer);
  },[busy,load]);
  async function resume(jobId:string){
    if(!profile||busy||stopLock.current)return;
    stopLock.current=true;setBusy(true);setError('');setHistoryFilter('all');setPageOffset(0);setSort('discovered');
    try{await resumeResearch(profile.id,jobId);await load();}catch(e){setError(e instanceof Error?e.message:'Could not resume search.');}
    finally{stopLock.current=false;setBusy(false);}
  }
  async function stop(jobId:string){
    if(stopLock.current)return;
    stopLock.current=true;setStopping(jobId);setError('');
    try{const result=await stopResearch(jobId);setStopConfirm(null);setNotice(result.job.status==='cancelled'?'Search stopped. Previously saved ideas are unchanged; unused idea allowance is returned.':'This search has already finished.');await load();}
    catch{setError('Could not stop the search. Please try Stop search again.');}
    finally{stopLock.current=false;setStopping(null);}
  }
  useEffect(() => {
    if (!activeJobs.length) return;
    let running=false;
    const timer = window.setInterval(() => {
      if(running)return;
      running=true;
      void Promise.all(activeJobs.map((job) => syncResearch(job.id).catch(() => null))).then(() => load().catch(() => undefined)).finally(()=>{running=false;});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJobs, load]);

  const actionLock = useRef(false);
  async function action(work: () => Promise<unknown>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true); setError("");
    try { await work(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Discover could not complete that action."); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function find(count: number) {
    if (busy || activeJobs.length || !feed?.active) return;
    if (!useContentProfile && !effectiveQuery) { setError("Enter a topic or turn on your content profile."); return; }
    if ((feed.remaining ?? 0) < count) { setError("Choose fewer results to fit your remaining allowance."); return; }
    const searchMode=sourceMode==='all'?'videos':sourceMode;
    if(sourceMode==='all')setSourceMode('videos');
    if(searchKeywords(effectiveQuery).length>5||effectiveQuery.length>300){setError('Use up to five phrases, totaling 300 characters.');return;}
    if (!profile) { setError("Create a content profile before researching."); return; }
    await action(async () => {
      if(sourceMode==='articles')try{resolveArticleWindow(articleDate);}catch{throw Error('Choose valid dates within the past year, ending no later than today.');}
      setHistoryFilter('all');setPageOffset(0);setSort('discovered');
      await requestResearch(profile.id, count,{searchQuery:effectiveQuery,useContentProfile,sourceMode:searchMode,...(sourceMode==='articles'?{articleDate}:{discoveryFilters:filters})});
    });
  }
  const visible = feed?.opportunities ?? [];
  const latestJob = feed?.jobs.filter(job=>job.content_profile_id===profile?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  const filterCount = (filter: HistoryFilter) => feed?.statusCounts?.[filter] ?? 0;
  const currentPage = Math.floor(pageOffset / archivePageSize) + 1;
  const totalPages = Math.max(1, Math.ceil((feed?.opportunityTotal ?? 0) / archivePageSize));
  const hasPreviousPage = pageOffset > 0;
  const hasNextPage = pageOffset + archivePageSize < (feed?.opportunityTotal ?? 0);
  const emptyTitle: Record<HistoryFilter, string> = { all: "Your ideas will show up here.", saved: "No saved ideas yet.", used: "No used ideas yet.", skipped: "Nothing has been skipped yet." };
  const emptyText: Record<HistoryFilter, string> = { all: "Search a topic above to find your next video idea.", saved: "Tap the bookmark on an idea you want to keep.", used: "Remake an idea or react to a video to start creating.", skipped: "Ideas you skip will stay here, out of your main feed." };
  function moveArchivePage(nextOffset: number) {
    setPageOffset(nextOffset);
    window.requestAnimationFrame(() => discoverRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <section className="discover" ref={discoverRef} aria-labelledby="discover-heading">
    <header className="discover-header">
      <div>
        <span className="eyebrow">DISCOVER</span>
        <h1 id="discover-heading">Find what’s working. Make it your own.</h1>
        <p>Find high-performing videos across Instagram, TikTok, and YouTube. See how they fit your audience, then remake the idea or add your reaction.</p>
      </div>
      <div className="discover-allowance" aria-label="Research allowance">
        <strong>{feed?.remaining ?? "—"}</strong><span>ideas left</span>
      </div>
    </header>
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <form className="discover-query" aria-label="Search topic" onSubmit={event=>{event.preventDefault();void find(searchCount);}}><label htmlFor="discover-query">What do you want to find?</label><div className="discover-keyword-entry"><input id="discover-query" type="text" maxLength={300} value={keywordDraft} disabled={busy||activeJobs.length>0} onChange={event=>{if(!effectiveQuery&&event.target.value.trim())updateFilters({...filters,platform:'all'});setKeywordDraft(event.target.value);}} placeholder="What’s your next video about?"/><button type="button" disabled={busy||activeJobs.length>0||!keywordDraft.trim()} onClick={addKeyword}>Add keyword</button></div><p>Search a topic, or use Add keyword to combine up to five phrases. Press Enter to search.</p><div className="discover-keywords">{searchKeywords(searchQuery).map(term=><span key={term}>{term}<button type="button" aria-label={'Remove '+term} disabled={busy||activeJobs.length>0} onClick={()=>setSearchQuery(searchKeywords(searchQuery).filter(value=>value!==term).join(', '))}>×</button></span>)}</div>{(searchKeywords(effectiveQuery).length>5||effectiveQuery.length>300)&&<p role="alert">Use up to five phrases, totaling 300 characters.</p>}{sourceMode!=='articles'&&<label>Search networks<select value={filters.platform} disabled={busy||activeJobs.length>0} onChange={event=>updateFilters({...filters,platform:event.target.value as typeof filters.platform})}><option value="all">All networks · TikTok, Instagram &amp; YouTube</option><option value="TikTok">TikTok</option><option value="Instagram">Instagram</option><option value="YouTube">YouTube</option></select></label>}<label><input type="checkbox" checked={useContentProfile} disabled={busy||activeJobs.length>0} onChange={event=>setUseContentProfile(event.target.checked)}/> Rank for my content profile</label><p>{useContentProfile?'Your keywords set the topic; your profile helps rank the best matches. Leave keywords blank to explore your profile’s topics.':'Enter a topic to search without your profile’s topic or screening rules.'}</p>{sourceMode==='videos'&&(filters.minViews>0||filters.minEngagementRate>0||filters.maxAgeDays>0||filters.mode!=='relevant')&&<button type="button" disabled={busy||activeJobs.length>0} onClick={()=>updateFilters({...filters,mode:'relevant',minViews:0,minEngagementRate:0,maxAgeDays:0})}>Broader results · any date, no minimum metrics</button>}{sourceMode==='videos'&&<DiscoverFilters value={filters} onChange={updateFilters} disabled={busy||activeJobs.length>0} hidePlatforms/>}<div className="discover-query-submit"><label>How many?<select value={searchCount} disabled={busy||activeJobs.length>0} onChange={event=>setSearchCount(Number(event.target.value))}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><button type="submit" className="discover-primary-find" disabled={busy||activeJobs.length>0||!feed?.active||!profile||(!useContentProfile&&!effectiveQuery)||searchKeywords(effectiveQuery).length>5||effectiveQuery.length>300||(feed?.remaining??0)<searchCount}>{busy?'Searching…':`Search · ${searchCount} ${sourceMode==='articles'?'articles':'clips'}`}</button></div>{feed?.active&&(feed.remaining??0)<searchCount&&<p className="search-allowance-hint" role="status">You have {feed.remaining} ideas left. Choose a smaller result count to search.</p>}</form>
    <details className="discover-settings"><summary>{useContentProfile?`Content profile: ${profile?.name??'Choose a profile'}`:'Save results to a profile'}</summary>    <div className="discover-profile-choice">
      <div><strong>{useContentProfile?'Searching with this Content Profile':'Direct search · profile off'}</strong><span>{useContentProfile?'Your profile guides ranking, not strict exclusions. A typed search sets the topic.':'Search uses your words. Results are saved under the selected profile.'}</span></div>
      <label htmlFor="discover-profile-select">Content Profile
        <select id="discover-profile-select" value={profile?.id ?? ''} disabled={busy || !activeProfiles.length} onChange={event=>onSelectProfile(event.target.value)}>
          {!activeProfiles.length&&<option value="">Create a Content Profile first</option>}
          {activeProfiles.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
</details>
    {!activeJobs.length && latestJob?.status==='failed' && <div className="error-message" role="alert"><strong>Search couldn’t finish</strong><p>{latestJob.interruption_reason?`${latestJob.delivered_count} of ${latestJob.requested_count} clips ready. Search stopped at ${latestJob.interruption_reason.replaceAll('_',' ')}.`:latestJob.error_code==='PROVIDER_INCOMPLETE'?'The search provider returned an incomplete result.':'The search provider could not finish this run.'} Your saved ideas are safe. Unused idea allowance has been released. Choose 1–10 and try again.</p></div>}

    {!activeJobs.length&&latestJob?.incremental_delivery&&['failed','cancelled'].includes(latestJob.status)&&latestJob.delivered_count<latestJob.requested_count&&<div className="search-resume"><p>Your clips are saved. Continue with the same topic and filters; only the remaining clips count against your allowance. Continuing starts another bounded search and may incur provider processing costs.</p><button type="button" disabled={busy} onClick={()=>void resume(latestJob.id)}>Find remaining {latestJob.requested_count-latestJob.delivered_count} clips</button></div>}
    {latestJob&&<details className="discover-settings"><summary>Last search details</summary>    {!activeJobs.length && latestJob?.status==='ready' && latestJob.delivered_count<latestJob.requested_count && <p role="status">{latestJob.phase} Only delivered ideas count against your allowance.</p>}    {!activeJobs.length&&latestJob?.engagement_diagnostics&&<p className="search-filter-diagnostics">{latestJob.engagement_diagnostics.passed} of {latestJob.engagement_diagnostics.freshCandidates} fresh clips passed your search filters. {Object.entries(latestJob.engagement_diagnostics.excluded).map(([reason,count])=>`${count} excluded: ${({below_outlier_multiple:'below outlier multiple',outlier_baseline_unavailable:'outlier comparison unavailable',outside_date_range:'outside date range',date_unavailable:'date unavailable',below_minimum_views:'views below minimum',views_unavailable:'views unavailable',below_minimum_engagement:'engagement below minimum',engagement_unavailable:'engagement unavailable'} as Record<string,string>)[reason]??(reason==='baseline'?'outlier baseline missing, insufficient, or below threshold':reason==='date'?'outside date range or date unavailable':reason==='views'?'views below minimum or unavailable':reason==='engagement'?'engagement below minimum or unavailable':reason)}`).join(' · ')}. {latestJob.engagement_diagnostics.relevanceRejected!==undefined&&<span>{latestJob.engagement_diagnostics.metadataReviewed!==undefined&&<>{latestJob.engagement_diagnostics.metadataReviewed} clips reviewed for relevance · </>}{latestJob.engagement_diagnostics.relevanceRejected} rejected · {latestJob.engagement_diagnostics.needsContentReview??0} needed content review. </span>}{latestJob.engagement_diagnostics.contentReviewAccepted!==undefined&&<span>Content review: {latestJob.engagement_diagnostics.contentReviewAccepted} relevant · {latestJob.engagement_diagnostics.contentReviewRejected??0} off topic · {latestJob.engagement_diagnostics.contentReviewUnresolved??0} unresolved.</span>}</p>}
    {!activeJobs.length&&latestJob?.retrieval_diagnostics?.rawReturned!==undefined&&<p className="search-filter-diagnostics">Search returned {latestJob.retrieval_diagnostics.rawReturned} records; retained {latestJob.retrieval_diagnostics.uniqueRetained} unique new clips. {latestJob.retrieval_diagnostics.requests} of {latestJob.retrieval_diagnostics.requestLimit} collection API calls used. {latestJob.retrieval_diagnostics.stopReason==='request_budget'?'Collection reached its budget; results do not represent all available clips.':latestJob.retrieval_diagnostics.stopReason==='provider_limited'?'Collection was limited by the provider.':''}</p>}
    {!activeJobs.length&&(latestJob?.review_limited||latestJob?.relevance_review_limited)&&<p className="search-filter-diagnostics">The relevance provider could not finish every check. Unresolved clips were not approved.</p>}
</details>}
    {!feed?.active ? <div className="discover-empty"><Lightbulb size={28}/><h2>{feed?'Discover is almost ready.':'Loading your ideas…'}</h2>{feed&&<p>This feature is available to selected Pro pilot accounts.</p>}</div> : <>
      <div className="discover-source-options"><div role="group" aria-label="Source type">{(['videos','articles','all'] as const).map(mode=><button type="button" key={mode} aria-pressed={sourceMode===mode} disabled={busy} onClick={()=>{setSourceMode(mode);setPageOffset(0);setFeed(null);}}>{mode==='videos'?'Videos':mode==='articles'?'Articles':'All'}</button>)}</div>{sourceMode==='articles'&&<><label>Published within<select disabled={busy} value={articleDate.preset} onChange={e=>setArticleDate({...articleDate,preset:e.target.value as ArticleDate['preset']})}>{Object.entries({day:'Past 24 hours',week:'Past 7 days',month:'Past 30 days',quarter:'Past 90 days',year:'Past year',custom:'Custom dates'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{articleDate.preset==='custom'&&(['start','end'] as const).map(field=><label key={field}>{field==='start'?'From':'Through'}<input type="date" disabled={busy} min={localDate(new Date(Date.now()-365*86400000),articleDate.timezone)} max={localDate(new Date(),articleDate.timezone)} value={articleDate[field]??''} onChange={e=>setArticleDate({...articleDate,[field]:e.target.value})}/></label>)}</>}</div>



      <div className="discover-results-toolbar"><nav className="discover-filters" aria-label="Idea history">{historyFilters.map(([filter, label]) => <button key={filter} className={historyFilter === filter ? "active" : ""} aria-pressed={historyFilter === filter} onClick={() => { setHistoryFilter(filter); setPageOffset(0); }}>{label}<span>{filterCount(filter)}</span></button>)}</nav><label className="discover-sort">Sort by<select value={sort} disabled={busy} onChange={e=>{setSort(e.target.value as ResearchSort);setPageOffset(0);}}>{Object.entries(researchSortLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
      {activeJobs.map((job) => {
        const progress = deliveryProgress(job,clockNow);
        const title=`${progress.delivered} of ${job.requested_count} clips ready · ${progress.percent}% complete`;
        return <section className="research-progress" key={job.id} aria-label={title}>
          <div className="research-progress-head"><div className="research-progress-title"><LoaderCircle className="spin" size={19}/><div><strong>{title}</strong><span>{progress.elapsed} elapsed · Result completion</span></div></div></div>
          <div className="research-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label={title}><i style={{ width: `${progress.percent}%` }} /></div>
          <p>{job.phase}</p>
          {stopConfirm===job.id?<div className="research-stop-confirm"><strong>Stop this search?</strong><p>Unfinished clips from this search will not be added. Previously saved ideas stay available, and work already sent to a provider may still incur a cost.</p><div><button type="button" className="button secondary" disabled={stopping===job.id} onClick={()=>setStopConfirm(null)}>Keep searching</button><button type="button" className="button primary" disabled={stopping===job.id} onClick={()=>void stop(job.id)}>{stopping===job.id?'Stopping…':'Stop search'}</button></div></div>:<button type="button" className="button secondary" onClick={()=>setStopConfirm(job.id)}>Stop search</button>}
        </section>;
      })}
      {!activeJobs.length && !visible.length && <div className="discover-empty"><Lightbulb size={28}/><h2>{emptyTitle[historyFilter]}</h2><p>{emptyText[historyFilter]}</p></div>}
      {profile&&feed?.pilot?.configured&&feed.pilot.profileId===profile.id&&<DiscoveryPilotControls key={profile.id} profileId={profile.id} revision={watchRevision} onUpdated={()=>void load()}/>}
      <div className="opportunity-list">{visible.map((opportunity) => {
        const source = opportunity.source_snapshot[0];
        const embed = source ? embeddedClip(source.url) : null;
        const needsCheck = needsSourceCheck(source?.sourceType,opportunity.uncertainty);
        const creator=source?.creator??(source?creatorFromUrl(source.url):null);
        const isArticle=source?.sourceType==='article';
        return <article className="opportunity-card" key={opportunity.id}>
          <div className="signal-rail" aria-hidden="true" />
          <div className={`opportunity-layout${embed ? " has-inline-clip" : ""}`}>
            {embed && <InlineClip embed={embed} title={opportunity.title} sourceUrl={source.url} />}
            <div className="opportunity-content">
              <div className="opportunity-meta">
                <span className="signal-category">{opportunity.category}</span>
                <span className={needsCheck ? "signal-status signal-status-check" : "signal-status"}>{needsCheck ? <><Eye size={14}/> {isArticle ? 'Read first' : 'Watch first'}</> : <><ShieldCheck size={14}/> Ready to use</>}</span>
                <small>Audience fit {Math.round(opportunity.relevance_score)}%</small>
              </div>
              {!isArticle&&!source?.engagement&&<div className="clip-engagement"><small>Performance data unavailable. This is an idea match, not a verified viral result.</small></div>}
              {!isArticle&&source?.engagement&&<div className="clip-engagement" aria-label="Reported clip engagement"><strong>{source.engagement.views===null?'Views unavailable':new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(source.engagement.views)+' views'}</strong><span>{source.engagement.likes===null?'Likes unavailable':new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(source.engagement.likes)+' likes'}</span><span>{source.engagement.rate===null?'Engagement unavailable':source.engagement.rate.toFixed(1)+'% engagement'}</span>{source.engagement.baseline&&<strong>{source.engagement.baseline.ratio.toFixed(1)}× creator median · {source.engagement.baseline.sampleSize} recent videos</strong>}<small>{source.engagement.provider} snapshot · {new Date(source.engagement.observedAt).toLocaleDateString()}</small></div>}
              <div className="signal-main">
                <div>
                  <h2>{opportunity.title}</h2>
                  {isArticle&&<p><a href={source.url} target="_blank" rel="noreferrer">Read article · {new URL(source.url).hostname.replace(/^www\./,'')}</a> · Published {opportunity.published_at?.slice(0,10)}<br/>{opportunity.why_audience_cares}</p>}
                  <p className="opportunity-summary">{opportunity.factual_summary}</p>
                </div>

              </div>
              <div className="signal-take">
                <span><Sparkles size={15}/> YOUR ORIGINAL ANGLE</span>
                <p>{opportunity.recommended_angle}</p>
              </div>
              <details className="idea-details"><summary>Why this idea works &amp; source details</summary>
              <div className="signal-points">
                <div><span>WHY IT FITS YOUR AUDIENCE</span><p>{opportunity.creator_connection}</p></div>
                {opportunity.suggested_hook && <div><span>A HOOK TO MAKE YOUR OWN</span><p>{opportunity.suggested_hook}</p></div>}
              </div>
              {needsCheck && <details className="signal-proof"><summary><span><Eye size={15}/> Quick check before you use this</span><ChevronDown size={16}/></summary><p>{opportunity.uncertainty}</p>{source && <a className="proof-source" href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open source</a>}</details>}
              {!isArticle&&<div className="signal-points"><div><span>PERFORMANCE SIGNAL</span><p>{source?.engagement?.baseline ? `${source.engagement.baseline.ratio.toFixed(1)}× this creator’s median views across ${source.engagement.baseline.sampleSize} recent videos. A comparison of reported views, not a promise of future reach.` : source?.engagement?.views != null ? 'Reported views and engagement show audience response. No creator baseline is available, so breakout performance is unverified.' : 'Metrics are missing; evaluate the idea and watch the source before choosing it.'}</p></div></div>}
              {!isArticle&&<div className="discovery-evidence"><strong>{reviewLabel(source?.review)}</strong>{source?.review?.accessibility&&source.review.accessibility!=='not_checked'&&<span> · {source.review.accessibility}</span>}<details><summary>Source evidence and limits</summary><p>{source?.review?.limitations??'Only the title/caption metadata has been inspected. Watch the original before reacting.'}</p>{source?.review?.claims&&<p><strong>Speaker’s claims:</strong> {source.review.claims}</p>}{source?.review?.observations&&<p><strong>Sampled observations:</strong> {source.review.observations}</p>}{source?.review?.timestamps?.length? <p>Sampled at {source.review.timestamps.map(t=>t.toFixed(1)+'s').join(', ')}</p>:null}</details></div>}
              {profile&&feed?.pilot?.enabled&&feed.pilot.profileId===profile.id&&creator&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void action(async()=>{await discoverySettings(profile.id,'follow',{url:creator.url});setWatchRevision(x=>x+1);setNotice('Creator added to this profile’s watchlist.');})}>Follow creator · {creator.name}</button>}
              </details>
              <footer>
                <div className="opportunity-actions">
                  <button className={`icon-action${opportunity.status === "saved" ? " is-saved" : ""}`} aria-label={opportunity.status === "saved" ? "Idea saved" : "Save idea"} title={opportunity.status === "saved" ? "Saved" : "Save idea"} disabled={busy || opportunity.status === "saved"} onClick={() => void action(() => researchFeedback(opportunity.id, "saved"))}><Bookmark size={17}/></button>
                  <button className="icon-action" aria-label="Skip idea" title="Skip idea" disabled={busy} onClick={() => { setRejecting(opportunity.id); setRefining(null); }}><ThumbsDown size={17}/></button>
                  <button className="icon-action" aria-label="Change the idea" title="Change the idea" disabled={busy} onClick={() => { setRefining(opportunity.id); setRejecting(null); }}><WandSparkles size={17}/></button>
                  <button className="button secondary" disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "selected"); onCreate(opportunity, "original"); })}>Remake this idea</button>
                  <button className="button primary use-idea" disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "selected"); onCreate(opportunity, "reaction"); })}><Clapperboard size={17}/> React to this video<Check size={15}/></button>
                </div>
              </footer>
            </div>
          </div>
          {refining === opportunity.id && <div className="opportunity-refine"><label>How should we change it?<input value={instruction} maxLength={1000} placeholder="Make it more helpful for my audience" onChange={(event) => setInstruction(event.target.value)}/></label><button className="button primary" disabled={busy || !instruction.trim()} onClick={() => void action(async () => { await refineResearchOpportunity(opportunity.id, instruction); setInstruction(""); setRefining(null); })}>Update</button><button disabled={busy} onClick={() => { setRefining(null); setInstruction(""); }}>Cancel</button></div>}
          {rejecting === opportunity.id && <><p>Your reason helps tailor future ideas for this audience.</p><div className="opportunity-reject"><label>Why are you skipping it?<select value={reason} onChange={(event) => setReason(event.target.value)}>{rejectReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button primary" disabled={busy} onClick={() => void action(async () => { await researchFeedback(opportunity.id, "rejected", reason); setRejecting(null); })}>Skip it</button><button disabled={busy} onClick={() => setRejecting(null)}>Cancel</button></div></>}
        </article>;
      })}</div>
      {feed && feed.opportunityTotal > 0 && <nav className="archive-pagination" aria-label="Idea archive pages"><button disabled={busy || !hasPreviousPage} onClick={() => moveArchivePage(Math.max(0, pageOffset - archivePageSize))}><ChevronLeft size={17}/>Previous</button><span aria-live="polite">Page {currentPage} of {totalPages}<small>{feed.opportunityTotal} ideas</small></span><button disabled={busy || !hasNextPage} onClick={() => moveArchivePage(pageOffset + archivePageSize)}>Next<ChevronRight size={17}/></button></nav>}
    </>}
  </section>;
}

export function InlineClip({ embed, title, sourceUrl }: { embed: EmbeddedClip; title: string; sourceUrl: string }) {
  const [playerVersion, setPlayerVersion] = useState(0);
  useEffect(() => {
    const stopPlaybackWhenHidden = () => { if (document.hidden) setPlayerVersion(version => version + 1); };
    document.addEventListener("visibilitychange", stopPlaybackWhenHidden);
    return () => document.removeEventListener("visibilitychange", stopPlaybackWhenHidden);
  }, []);
  // Let the tap reach the provider's player directly. Reloading an iframe on
  // our own overlay click loses the user gesture and can require a second tap.
  const playerSource = new URL(embed.src);
  playerSource.searchParams.set('autoplay', '0');
  if (embed.platform === 'YouTube') playerSource.searchParams.set('mute', '0');
  if (embed.platform === 'TikTok') playerSource.searchParams.set('muted', '0');
  return <aside className="inline-clip">
    <div className="inline-clip-header"><span>{embed.platform} clip</span><a href={sourceUrl} target="_blank" rel="noreferrer" aria-label="Open the original post" title="Open original post"><ExternalLink size={14}/></a></div>
    <div className="inline-clip-frame"><iframe key={`${embed.src}-${playerVersion}`} src={playerSource.toString()} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
  </aside>;
}
