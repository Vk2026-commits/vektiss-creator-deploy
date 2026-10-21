# Make Money With AI discovery pilot

Scope: profile `3ea48507-fd4b-45bd-acfe-11d73489d867` on isolated Creator staging `meihyxdibqbqggogseon`. Migration seeds only this profile, disabled, and an empty watchlist. Other profiles retain their prior search path.

With `CREATOR_DISCOVERY_PROVIDER=scrapecreators`, five focused lanes use Scrape Creators public-video search. The server-only credential is `CREATOR_SCRAPECREATORS_API_KEY`; no value belongs in this document or the frontend. Other profiles and the profile rollback retain the existing Apify/Perplexity discovery path. Perplexity continues metadata relevance screening and OpenAI continues media analysis. Canonical platform video IDs deduplicate a compact pool of up to 250 source records; known threshold failures are removed before selecting at most 40 unique clips for relevance screening. The strongest five eligible primary clips enter the authenticated media worker. Imports, 180-second/500-MB limits, transcription and chronological frame extraction reuse existing tools without automatic cutting. Reviews use the research job UUID for idempotency and check ownership/cancellation before each provider analysis. Interrupted reviews return explicit metadata-only leads rather than silently rerunning paid inspection.

On the legacy discovery path, optional server-only `CREATOR_YOUTUBE_API_KEY` enables official search, details and followed-channel upload retrieval. Missing credentials or quota failures retain Apify YouTube discovery and produce diagnostics. The Scrape Creators pilot uses its own YouTube routes and does not silently fall back to Apify when authentication, credits, or requests fail. No browser credentials or new subscriptions are required.

Recommendations label metadata-only, transcript-reviewed or video-sampled evidence. Samples never imply continuous viewing or independent earnings verification. Claims, observations and suggested angles remain separate. All video recommendations retain Watch first, even if model uncertainty is empty. Script handoff retains evidence limitations.

Watchlists are profile-owned, initially empty, capped at 20 accounts and checked only during user searches. Canonical platform identifiers prevent repeated follows. YouTube handle/channel-ID aliases may remain separate until resolved by a provider. No example creators are automatically followed.

## Release and rollback

Apply `202610200001_discovery_pilot.sql`; deploy research-request, research-sync, research-feed, discovery-settings and script-assistant with `supabase/functions/deno.json`. Publish the existing image with `publish-creator.yml` and update the existing Bunny pilot app. The custom domain serves its frontend from the existing Vercel project (`prj_bflC6b4Ht9e5med53Tdszqb6Oynl`), so also promote/deploy the tested commit there; its existing rewrites forward media requests to Bunny. Verify authenticated settings, media access, provider connections and a complete pilot search before enabling this profile. Its discovery-settings switch restores the old flow without deleting saved opportunities.

## Metrics

Job provider_metadata stores query lanes, provider/search diagnostics, native discovery runs/costs and review diagnostics (inspected, transcript-reviewed, video-sampled, elapsed milliseconds, generation IDs). Compare delivered_count with unique screened candidates for usable yield and video-sampled with inspected for inspection success. Match review generation IDs to creator_ai_generations for actual analysis costs. Existing research usage preserves native/screening costs and quota settlement. Unknown costs stay unknown; web-query and YouTube call counts are not dollar estimates.

```sql
select id,status,delivered_count,provider_metadata->'reviewDiagnostics' as inspection,
 provider_metadata->'providerDiagnostics' as limitations,
 provider_metadata->'searchDiagnostics' as search,
 extract(epoch from completed_at-started_at) as elapsed_seconds
from creator_research_jobs
where content_profile_id='3ea48507-fd4b-45bd-acfe-11d73489d867'
order by created_at desc limit 10;
```

Local validation: 413 tests pass, 2 skipped; two pre-existing avatar-pricing assertions fail, with that implementation byte-identical to Git HEAD. Production build and worker bundle pass. Targeted tests cover five lanes, cross-provider deduplication/cap, spoofed/nonvideo URLs, canonical follows, evidence accuracy, quota fallback, idempotent polling, media limits/reuse and database RLS/isolation. Existing cancellation/settlement tests pass.


## Live acceptance — 2026-10-20

Application revision `3845ba97e3ad0b8cf490d1020d39e4b56e981535` deployed through existing GitHub image publication, Bunny worker and Vercel frontend (`dpl_EHcixhqLHCBLK7HXfUb7QQR1S2eQ`). Health JSON and final frontend revision markers verified on both origins. No subscriptions or resources were purchased. Existing server credentials were reused. Official YouTube key was absent; fallback is visible in settings. The saved profile currently requests TikTok, so its acceptance run used that platform plus Perplexity web search; adapters for other allowed platforms remain available when selected in the profile.

Research job `3aee6082-c800-481b-ac77-b62a44021fc3` completed ready with seven recommendations from 14 fresh screened candidates (50% usable-result yield). Five source clips were imported, transcribed and frame-sampled successfully (100% inspection success). Two recommendations remained explicitly metadata-only. End-to-end observed latency was 329 seconds, including polling intervals; the inspection worker took 203.5 seconds. Native discovery returned 15 records with one previously seen source removed before screening.

Reported Apify cost was $0.061; screening recorded $0.05857; transcription and visual-analysis estimates totaled $0.58859765. Combined known/estimated provider cost: $0.70816765. Five supplementary Perplexity Search queries and hosting/worker charges were not reported as dollar charges in this acceptance run, so this is not a complete billed total. Later runs explicitly record the supplementary search as an unknown-cost usage event.

The live Discover UI displayed sampled and metadata-only badges, claims, limitations and timestamps. “Use idea” saved draft `d58c7be3-eb34-4e81-9979-9988d3652935` (“Audit the $1,000 AI Front-Desk Offer”) in the existing script editor, retaining video_sampled evidence, 64 timestamps and 2,899 transcript characters. No avatar generation or export started.

The profile switch was turned off and back on through the authenticated settings API. Existing opportunities remained; retrying completed sync returned the same seven results. Exactly one profile is configured/enabled, and its watchlist remains empty. Database ownership and cancellation/settlement tests passed. Full suite: 413 passed, two skipped, two pre-existing avatar-pricing failures; production build and hosted bundle passed.


## Scrape Creators and engagement filters — 2026-10-20

The pilot adds All/YouTube/Instagram/TikTok selection, relevance/high-engagement/creator-outlier modes, minimum views, minimum interaction rate, publication window, and outlier multiple. Platform also filters the saved archive; engagement thresholds apply to new searches, so legacy saved records remain visible with an explicit missing-metrics message. Interactions per view use available likes/comments/shares; hidden counters remain unknown. Popularity is not evidence of earnings.

Collection interleaves five search lanes across selected platforms, eight candidates per search response, and caps the deduplicated screening pool at 40. Each followed creator is checked during the search (up to 20). Up to ten detail calls share budget between YouTube and Instagram; Instagram search lacks views, and YouTube search lacks likes/publication dates. These are fetched before active thresholds can pass. YouTube Shorts search uses relevance sorting: the tested Shorts/popular combination returned zero, while relevance returned 25 Shorts. No fabricated counters or relative-date guesses fill missing data.

A search is bounded to 40 Scrape Creators requests: up to 35 collection/detail requests and five creator baseline requests. A populated watchlist reduces the available detail budget. Uninspected or incomplete metadata can reduce yield. The five baseline creators are selected from clips passing basic engagement/date filters. Their latest public feeds supply up to ten other clips, requiring at least five unique dated observations within 180 days and a positive median. This is a recent-feed comparison, not an age-matched causal measure or a complete channel history. Relevance screening can reject every statistical outlier.

Paid requests are claimed before dispatch. Concurrent polls cannot duplicate a batch. Interrupted calls are marked unknown/failed after 60 seconds and are not automatically replayed. Cancellation uses existing terminal guards and allowance settlement. Returned credit counts, unknown charges and remaining credits are recorded separately from USD; the provider-cost row deliberately has a null dollar amount. No services or subscriptions were purchased.

Frontend and media worker revision `fe34c485e042a839960ad8ece88a9e8e88dfdc1e` deployed via the existing Vercel and Bunny applications. Edge functions also include the empty-filter completion fix: the previous message exceeded the database's 120-character phase constraint. Regression coverage checks both ordinary and empty-filter completion lengths.

Validation: full suite 430 passed, 2 skipped, with 2 unchanged avatar-pricing failures. The subsequent phase regression and targeted discovery tests passed (19 tests). Production TypeScript/Vite build and GitHub worker build passed. Browser verification confirmed the platform/engagement controls and the Scrape Creators provider notice. Worker health returned 200 after rollout.

Live YouTube-only high-engagement search `174f471d-2fe2-4ba4-be8b-41cd6c91e618`: 37 unique candidates, 15 charged API credits/requests, 1 clip passed the 10,000-view/1%/90-day filters and relevance screening. The saved lead had 23,678 views, 1,095 likes, 36 comments (4.78% reported engagement). Media import returned VIDEO_FORMAT, so it remains Metadata only / unsupported / Watch first. No continuous-video or earnings verification is implied. Other candidates were excluded for insufficient or unavailable dates/views. This is evidence that collection, filtering and saving work, not a guarantee of five qualifying clips.

Live TikTok outlier test `e30dec40-9271-4985-8dfb-47e0aad51eb2`: 32 unique clips, 31 fresh, 5 creator comparisons, 10 API credits. Five statistical outliers reached relevance screening; none were recommended. The long empty-result message exposed the phase constraint bug, which was fixed rather than relaxing filters. That failed run released its entire reserved idea allowance. The empty-filter completion regression now passes within the 120-character constraint.


Repeat TikTok outlier acceptance `dfd97559-3a7a-49a8-a025-2d46e99dfbe3` completed ready in 187 seconds: 33 unique/fresh clips, 5 above-threshold creator comparisons, 2 relevant recommendations saved. Both media inspections succeeded with transcripts and timestamped frame samples (82.6 seconds for media review). Their reported views were 1,252,170 and 1,516,143; each comparison used seven other recent public clips. Search cost was 10 reported API credits; 2 delivered ideas were charged and reserved_count returned to zero. The search diagnostics patch includes baseline-call credits in remaining-credit summaries for subsequent searches. Only the original pilot profile is enabled.


## Selection and relevance upgrade — 2026-10-20

New Scrape Creators pilot jobs use selectionVersion 2. Older jobs remain readable and follow their original checkpoints. Only Make Money With AI is enabled; the existing profile switch still restores the prior flow. No migration, additional service, purchase, or worker redeployment is required.

Collection now normalizes all returned page records rather than keeping only the first eight. It retains up to 250 compact unique sources, skips previously saved video IDs, excludes confirmed numeric/date failures before shortlisting, and chooses at most 40 qualifying sources for metadata relevance review. Topic phrases come from the profile; high minimum-view requests use TikTok most-liked ordering independently of the final relevance ranking. YouTube retains Shorts/relevance search and requests extras. Selected platform controls override legacy platform wording inside saved screening prose.

Missing metadata is distinct from failure. Detail lookups use the remaining 40-request budget, avoid clips already known to fail, preserve useful earlier metadata, and recompute interaction rate from merged counts. Returned cursors/continuation tokens and Instagram pages are checkpointed. Each search family is bounded to three requests; repeated cursors do not loop. When relevance rejects a shortlist and budget/screening slots remain, collection resumes to seek replacements. Outlier mode reserves five provider calls for its existing bounded creator comparisons. No thresholds are silently lowered.

Metadata screening returns accepted/rejected/needs_content_review decisions per source. Missing decisions remain unresolved. Up to five total inspections combine strong metadata leads and unclear captions. After the existing media worker returns transcripts and timestamped frames, a separate relevance pass evaluates that evidence; rejected or unresolved inspected clips do not become recommendations. Successful sampled review remains different from continuous viewing or income verification. Uninspected accepted metadata leads retain Metadata only / Watch first.

Screening deadlines start at the current screening batch, not search creation. Rejected rate-limited submissions use a 30-second backoff and a separate three-minute queue allowance. Interrupted requests with unknown outcomes are not silently replayed. Compare-and-set stage/timestamp checks prevent late polls from overwriting newer stages or cancelled jobs. Feed diagnostics distinguish insufficient values, unavailable fields, metadata relevance rejection, content-review outcomes, collection counts, and incomplete provider review. Legacy fields remain optional.

### Replay and live acceptance

Failed reference job: 73276c4f-538f-4799-97ae-5ecf2745c24a. Replay used the saved 40-source pool, removed the two sources already known when that job began, and preserved publication ages relative to the original search. The same 38 fresh sources still yielded one qualifying clip. The new diagnostic partition is 26 below minimum views, 9 outside the date range, and 2 with unavailable views. The old run discarded other page results before persistence, so replay cannot reconstruct them or claim they were unavailable on the platforms.

Live comparison: 6e7c3f11-a761-4a55-8f79-bec09cd5c478. Exact settings were preserved: All platforms, Relevant clips, 100,000 minimum views, 2% minimum engagement, last 90 days, 10 requested recommendations.

| Measure | Previous run | Upgraded live run |
|---|---:|---:|
| Fresh unique retained records | 38 | 230 |
| Clips meeting numeric/date criteria | 1 | 57 |
| Scrape Creators calls / reported credits | 25 | 15 |
| Relevant recommendations retained after quality review | 0 | 8 |

The new provider responses contained 279 records before deduplication and history removal. Forty qualifying sources were selected for relevance review. A provider rate limit prevented completion of one metadata batch during rollout; that limitation is recorded, and rejected submissions are now backed off independently of completed-batch timing. Eleven metadata candidates were retained. Five media inspections succeeded (194.2 seconds), and the final evidence-based pass accepted four and rejected one. Ten recommendations were initially saved. Final semantic quality review rejected two generic artist/freelance clips whose AI connection existed only in the suggested reaction angle. Eight remain: four Video sampled and four Metadata only, all with Watch first. Rejections use the existing authenticated feedback API and preserve saved history. Total live run duration was 667 seconds, including the provider delay and manual verification intervals. Reserved idea allowance returned to zero; ten delivered ideas were charged.

Final stored-source assertions: minimum views 146,081; minimum reported engagement 4.513%; oldest source under 83 days; zero threshold/date violations. All generated recommendations had explicit accepted model decisions, but semantic review still found the two off-topic examples described above. None relied on an inferred acceptance caused by an omitted model decision. The pilot now additionally requires an AI signal in the original title/caption, transcript, or affirmative visual observations for this AI-income profile. Candidate titles and hypothetical reaction angles cannot supply that evidence. Unclear sources require content review and unresolved sources remain ineligible. This guard supplements semantic review; an AI keyword alone never establishes income relevance. Media analysis estimates total $0.6157095 and screening usage records total $0.19186; Scrape Creators cost remains 15 reported credits rather than an invented USD value.

Validation: final full suite 449 passed, 2 skipped, with the same 2 pre-existing avatar-pricing failures and one database integration timeout. The timed-out database test passed on isolated rerun (693 ms). Additional targeted regression coverage checks omitted verdicts remain unresolved and generic freelance stories cannot pass using an invented AI reaction angle; negative visual observations do not supply affirmative topic evidence. Production TypeScript/Vite build passes. Tests cover post-eighth-result matches, duplicate crowding, partial detail enrichment, real versus unknown failures, profile/platform query behavior, pagination loops, fixed API budgets, cancellation, overlapping polls, late-stage responses, stage-specific deadlines, rate-limit backoff, and ambiguous-caption review.

Frontend was deployed through the existing Vercel production project; Edge request/sync/feed functions use the same existing Supabase project. The existing Bunny media worker was reused unchanged. Saved opportunities and other profiles are preserved.

## Article relevance correction — 2026-10-20

The article branch bypassed the video branch's relevance minimum. Live job `cca11e88-8442-4b6a-a624-0ddd636c728a` saved nine articles with raw relevance scores 8–10 on the defined 0–100 scale. The UI correctly displayed those raw percentages; there is no safe basis for retroactively multiplying them by ten. The nine new results were moved to skipped history using the authenticated existing feedback endpoint, preserving source records and history.

Article eligibility now requires at least 70/100 relevance before ranking or quota settlement, existing source IDs, valid unblocked source URLs, and the pilot's source-evidence AI-topic check. The model's generated headline or hypothetical reaction angle cannot establish the topic. Other profiles retain their own subjects; the minimum applies to articles consistently with videos. Scoring schema descriptions and article instructions explicitly define 0–100 percentages, require source-grounded audience fit and available article text rather than headline-only assumptions, and permit fewer or zero results. Focused profile searches and alternate wording remain within the existing provider run; dates and numeric controls are unchanged. No new service or UI scoring conversion was introduced.

Zero eligible results complete normally with zero delivered ideas and released reservations. Job metadata records the article minimum, candidate count, below-minimum count, unsupported/blocked count, and eligible count. The zero-result message clearly states that no strong matches were found. Relevance scores are model assessments, not objective probabilities or independently verified claims.

Validation: full suite 455 passed, 2 skipped, with only the two previously documented avatar-pricing failures. Production build passed. Regression tests cover 8/9/10 scores, the exact 70 boundary, high timeliness failing to rescue weak relevance, missing/blocked evidence, invented AI angles, other-profile subjects, explicit percentage instructions, and completed article handler settlement with zero delivered ideas.

Post-deployment live acceptance: `38045ee0-2883-44ad-b680-81948edf47a0`, same Make Money With AI profile, ten requested articles, Past 7 days / America/Chicago. Completed in 86 seconds with nine eligible articles, relevance 74–96, no below-minimum or unsupported/blocked candidates, and zero remaining reservation. Source examples include an AI-agent income experiment, AI customer-support service pricing, and freelance demand for correcting AI output. Claims and promotional limitations remain explicit; percentages are model relevance scores, not verified earnings. Browser verification confirmed nine active articles, nine old results in skipped history, correct percentages, and Best match sorting. No frontend change or worker redeployment was needed; existing Edge request/sync functions were deployed.
