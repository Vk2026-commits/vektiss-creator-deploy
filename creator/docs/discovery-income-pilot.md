# Make Money With AI discovery pilot

Scope: profile `3ea48507-fd4b-45bd-acfe-11d73489d867` on isolated Creator staging `meihyxdibqbqggogseon`. Migration seeds only this profile, disabled, and an empty watchlist. Other profiles retain their prior search path.

Five focused lanes use native Apify actors plus Perplexity Search. Canonical platform video IDs deduplicate up to 40 candidates before screening. The strongest five eligible primary clips enter the authenticated media worker. Imports, 180-second/500-MB limits, transcription and chronological frame extraction reuse existing tools without automatic cutting. Reviews use the research job UUID for idempotency and check ownership/cancellation before each provider analysis. Interrupted reviews return explicit metadata-only leads rather than silently rerunning paid inspection.

Optional server-only `CREATOR_YOUTUBE_API_KEY` enables official search, details and followed-channel upload retrieval. Missing credentials or quota failures retain Apify YouTube discovery and produce diagnostics. No browser credentials or new subscriptions are required.

Recommendations label metadata-only, transcript-reviewed or video-sampled evidence. Samples never imply continuous viewing or independent earnings verification. Claims, observations and suggested angles remain separate. All video recommendations retain Watch first, even if model uncertainty is empty. Script handoff retains evidence limitations.

Watchlists are profile-owned, initially empty, capped at 20 accounts and checked only during user searches. Canonical platform identifiers prevent repeated follows. YouTube handle/channel-ID aliases may remain separate until resolved by a provider. No example creators are automatically followed.

## Release and rollback

Apply `202610200001_discovery_pilot.sql`; deploy research-request, research-sync, research-feed, discovery-settings and script-assistant with `supabase/functions/deno.json`. Publish the existing image with `publish-creator.yml` and update the existing Bunny pilot app. Verify authenticated settings, media access, provider connections and a complete pilot search before enabling this profile. Its discovery-settings switch restores the old flow without deleting saved opportunities.

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

Local validation: 406 tests pass, 2 skipped; two pre-existing avatar-pricing assertions fail, with that implementation byte-identical to Git HEAD. Production build and worker bundle pass. Targeted tests cover five lanes, cross-provider deduplication/cap, spoofed/nonvideo URLs, canonical follows, evidence accuracy, quota fallback, idempotent polling, media limits/reuse and database RLS/isolation. Existing cancellation/settlement tests pass.
