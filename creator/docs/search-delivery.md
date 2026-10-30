# Incremental Discover delivery

The account flag `creator_search_delivery_flags.enabled` opts new video searches into the native Scrape Creators incremental path. Enabled sitewide for existing and future accounts by migration `202610300002_search_delivery_sitewide.sql`, following explicit owner authorization. Articles remain unchanged. Require the existing server-side Scrape Creators credential before enabling an account. Ricky's user ID is verified from `creator_profiles`, never inferred from an email string in the frontend.

## Limits and behavior

Per explicit search attempt: at most 40 retrieval calls, 120 candidate reviews, three concurrent retrieval calls, two concurrent review starts. Native calls time out after 23 seconds; a known 429/5xx can enqueue one retry, within the same retrieval budget. Unknown interrupted charges are not retried automatically. Additional keyword variations and pagination use the existing query planner. Review the available pool before further retrieval; do not reset the ledger between rounds. Stop is terminal.

Publish qualifying clips through `creator_search_deliver`, which locks the job and entitlement, deduplicates by canonical source URL and normalized title, writes source links and feedback, then transfers allowance from reserved to delivered atomically. Final settlement only charges any unsettled delta. A short search uses `failed` with an explicit `interruption_reason`; never `ready`. Previously saved clips remain visible.

Resume creates an owned child job for the missing count from the parent's saved brief, with a unique `resume_of` preventing repeat submissions. The UI explicitly discloses that a continuation is a new bounded provider attempt. Resume the child if it is also interrupted. It never mutates the parent's results.

## Cache and progress

Owner-private cache keys include the complete brief (profile, topic and filters), source evidence and schema version. Successful metadata is fresh for 15 minutes; completed review responses for one hour. Failed or incomplete responses are not reused. Expired entries are pruned on writes. Cache errors do not substitute fabricated data.

Progress is delivered/requested, not a time forecast. Persist `first_result_at`, stage, delivered count, interruption reason and per-batch delivery metrics. Poll at three-second intervals with a local in-flight guard. Browser refresh reloads persisted jobs. Search and resume return the history to newest results.

## Rollout and checks

Apply migration `202610300001_incremental_search.sql`, then deploy research-request, research-sync and research-feed, then the frontend. The initial Ricky-only rollout was expanded sitewide at the owner’s explicit request. A signup trigger enables future accounts; per-account flags remain available for rollback. Disable the flag to route future requests back to the old implementation; active incremental jobs still finish on their recorded path.

Run the search-delivery, search-delivery-db, search-cache, search-rounds, discovery-engagement, research-stop and direct-search test suites, plus the build. Database tests include partial settlement, duplicate delivery, cross-owner rejection, terminal retries, and reaching exactly five despite excess candidates.

For real-provider validation, use an agreed paid test budget to verify real provider delivery for Ricky, including a refresh and a slow network. Compare median/p95 time to first result (`first_result_at - started_at`), time to target, fill rate, and actual reported provider costs. Do not promise a measured speed improvement until these samples exist.
