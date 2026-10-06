# Vektiss Personalized Research — Implementation Plan

**Status:** Architecture reviewed; staged implementation ready  
**Scope:** Creator Pro / pilot only  
**Product name in the customer experience:** **Discover** and **Content Opportunities**  
**Provider:** Perplexity is infrastructure only; Vektiss owns creator profiles, history, rankings, entitlement state, and opportunity records.

## A. Current architecture findings

### Application and deployment

- The app is a **Vite + React 19** single-page application under `creator/`. It uses the browser-safe Supabase URL and publishable key only.
- Authentication is Supabase email OTP. The app scopes all workspace reads to `auth.uid()` / `session.user.id`.
- Server-side AI lives in **Supabase Edge Functions**, not in the browser. The primary function, `script-assistant`, uses the Supabase service-role key to authenticate the caller, load the owned `content_profiles` row, call OpenAI, and record usage in `creator_ai_generations`.
- The video/import worker is a separate Bunny-hosted service. It already treats long source and draft work as durable operations; it does **not** provide a reusable research-job queue.
- Vercel serves the static Vite build. There is no application API server in the Vercel deployment.

### Existing Perplexity usage

- A deployed `content-search` Edge Function already calls Perplexity **Search API** at `POST /search` with the server-only `CREATOR_PERPLEXITY_API_KEY` secret.
- That endpoint is a **manual source finder**: it accepts a user query and returns up to eight raw article/video previews. It does not personalize the query beyond ownership validation, persist results, retain research sources, or record Perplexity usage/cost.
- The current source picker allows a user to select one source and send it through the existing script/video workflow. This is valuable plumbing to preserve, but it is not a personalized opportunity feed.

### Current creator intelligence available to reuse

The live database has exactly the two profile concepts needed as a starting point; no duplicate profile table is needed.

| Existing source | Existing fields useful for personalized research |
| --- | --- |
| `creator_profiles` | `display_name`, `bio`, plus `context.expertise`, `experience`, `industries`, `credentials`, `tone`, `communication_style`, `phrases_to_avoid`, `preferred_cta_style`, and `additional_context` |
| `content_profiles` | `name`, `primary_audience`, plus `strategy.audience_problems`, `audience_interests`, `content_pillars`, `source_topics`, `reaction_angles`, `desired_outcomes`, `tone`, `things_to_avoid`, `preferred_ctas`, and `additional_context` |
| `creator_scripts` | Existing content-generation destination. Its `brief` JSONB field can retain the selected opportunity identifier, source context, and source URLs without a second script pipeline. |
| `creator_ai_generations` | Existing OpenAI usage and cost telemetry; useful for the downstream script-generation part of the funnel. |
| `creator_processing_usage` / `creator_cost_entries` | Existing operational and cost-administration patterns to mirror, not overload with provider-specific research data. |

### Current data/security state

- Creator tables have RLS ownership policies based on `auth.uid()`.
- `creator_ai_generations` is intentionally written server-side and read by its owner.
- There is **no subscription, plan, entitlement, or research feature-flag table** in the current schema.
- There is no research queue/job table and therefore no durable research state today.
- The Supabase security advisor reports pre-existing advisories on unrelated server-only tables and older `SECURITY DEFINER` helpers. The new research migration will use explicit policies, restricted grants, and `search_path` hardening rather than copying those patterns. See the [Supabase database linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- The repository contains only the two current cost migrations even though the live database has earlier creator tables. The research migration must be additive, carefully named, and tested against the live schema; it must not recreate existing profile/script concepts.

## B. Proposed implementation plan

### Product flow

```text
Creator + Content Profile + past feedback
        ↓
Vektiss research brief builder
        ↓
ResearchProvider (Perplexity implementation)
        ↓
Persisted background research job
        ↓
Validated candidate pool + provider-returned sources
        ↓
Vektiss deterministic ranking, dedupe, and behavioral preferences
        ↓
Delivered Content Opportunities in Discover
        ↓
Save / reject / refine / create
        ↓
Existing Creator script and video workflow
```

### Stages

1. **Foundation and data contract**
   - Add shared Zod schemas/types for research briefs, source-safe candidate output, feedback, jobs, and opportunities.
   - Add an additive Supabase migration with multi-tenant RLS, constraints, idempotency keys, and indexes.
   - Add focused unit tests for the strict schema, source-ID mapping, dedupe, scoring, and quota math.

2. **Provider and server orchestration**
   - Create a `ResearchProvider` interface and a single `PerplexityResearchProvider` implementation under Supabase function shared code.
   - Start Perplexity Agent API jobs using `background: true`; persist the returned provider response ID immediately.
   - Use a Vektiss job row as the application source of truth. A short `research-sync` request retrieves a provider result and finalizes it; it never holds a browser request open for the research run.
   - Per Perplexity’s [background-mode documentation](https://docs.perplexity.ai/docs/agent-api/background-mode), the provider run continues after client disconnect. On page return, Discover reloads Vektiss jobs and syncs active ones.

3. **Personalized feed and actions**
   - Add a simple **Discover** navigation area with batch choices of 10, 20, or 30 opportunities.
   - Show human-facing phases: **Researching…**, **Reviewing sources…**, **Ranking opportunities…**, and **Your opportunities are ready.**
   - Add actions: Save, Not for me (with optional reason), Change angle, and Create.
   - Create opens the existing video/script workspace with the selected opportunity’s source context already in the script brief. It does not fork the content-generation pipeline.

4. **Pilot entitlement, economics, and admin controls**
   - Keep the global feature disabled by default, explicitly grant pilot accounts, and use a configurable per-user/month opportunity allowance (initial pilot default: 150).
   - Add a research administration panel or admin RPC/report with per-user and aggregate economics; retain raw usage so future invoice reconciliation is possible.
   - Expand profile fields only after observing pilot gaps; use an extensible JSONB `research_preferences` shape rather than duplicate broad profile columns.

5. **Launch hardening**
   - Load-test duplicate clicks/retries, verify RLS with two accounts, review production logs, tune candidate-pool sizing and source preferences, and then selectively enable more Pro accounts.

## C. Database changes

All new objects are additive and prefixed `creator_research_` to avoid collisions with the existing messaging and creator tables.

| Entity | Purpose | Key protection/design points |
| --- | --- | --- |
| `creator_research_config` | One server-managed global feature flag and configurable pilot defaults. | No direct browser writes; feature remains off by default. |
| `creator_research_entitlements` | Per-user pilot/Pro access, configurable monthly allowance, billing-period anchor, and optional override. | Server-only writes; supports manual assignment before a subscription system exists. |
| `creator_research_jobs` | Durable request, provider response ID, phase/status, requested/reserved/delivered counts, input snapshot, retry and idempotency data. | `user_id` + profile ownership checks, one idempotency key per user, lease/attempt fields, no allowance consumption before completion. |
| `creator_research_sources` | Canonical provider-returned source records: URL, title, excerpt, host, date, source type, retrieval metadata. | Only validated HTTPS URLs saved; canonical URL index supports reuse/dedupe. |
| `creator_research_opportunities` | Delivered opportunities: factual summary, audience relevance, creator connection, suggested angle/hook, category, scores, state, and source confidence. | Facts and creative recommendations stay in distinct fields; source facts are never overwritten by refinements. |
| `creator_research_opportunity_sources` | Many-to-many opportunity/source evidence links and source order. | Links only reference source IDs from the provider response, never model-invented URLs. |
| `creator_research_feedback` | Append-only events such as shown, saved, rejected, selected, angle-refined, script-created, and content-completed. | Captures controlled rejection reasons and optional free text; preserves behavioral history. |
| `creator_research_usage` | Per-provider request, response ID, model, latency, returned usage/cost, candidates found/accepted, and error data. | Provider-safe metadata only; nullable cost is explicitly unknown, never silently zero. |

### Entitlement and quota rules

- Initial default is **150 delivered opportunities per billing period**, configurable per entitlement or future plan.
- A job reserves capacity at request time to prevent concurrent requests exceeding the allowance, but the reservation is released if the job fails or is cancelled.
- The delivered count increases only when validated opportunities are committed successfully. Provider errors, malformed output, and duplicate-only candidate pools do **not** consume the allowance.
- A billing/subscription integration can later become the author of `creator_research_entitlements`; research logic will only read an entitlement contract and will not hard-code plan names or prices.

### RLS and writes

- Owners may read only their own jobs, opportunities, sources through opportunity links, and feedback.
- Browser clients will not receive insert/update grants for entitlement, usage, provider metadata, or final opportunity records.
- Authenticated Edge Functions authenticate the JWT, confirm the requested profile belongs to the caller, and perform controlled writes with the service-role client.
- Admin metrics are exposed only through a restricted admin check, separate from ordinary creator access.

## D. API and provider architecture

### Provider boundary

```ts
interface ResearchProvider {
  startDeepResearch(input: ProviderResearchInput): Promise<ProviderRun>;
  getRun(providerRunId: string): Promise<ProviderRunStatus>;
  cancelRun(providerRunId: string): Promise<void>;
}
```

- `PerplexityResearchProvider` is the only module that knows Perplexity URLs, headers, response shapes, model/preset configuration, and provider usage fields.
- The existing `content-search` function remains a lightweight manual source finder at first. It can later share the provider’s raw `search()` helper and usage logging without changing its public UI contract.
- API credentials remain server-side only under `CREATOR_PERPLEXITY_API_KEY`. No `VITE_` environment variable, browser request, database row, or telemetry payload may contain the key.

### Source-safe Perplexity run

The preferred initial provider call is Perplexity Agent API (`POST /v1/agent`) with web search, `background: true`, `store: false`, and JSON Schema response control.

- The response schema asks the model for candidates and **numeric source IDs**, not URLs.
- Perplexity documents that source links should be taken from its returned `citations`/`search_results` fields rather than from model-produced JSON because URLs in structured output can be unreliable. See [Output Control](https://docs.perplexity.ai/docs/agent-api/output-control).
- The orchestrator extracts the returned `search_results`, validates/canonicalizes them, maps candidate source IDs to that source pool, and rejects candidates without valid evidence.
- The server validates both the provider response and the final Vektiss candidate payload with Zod before any database write.
- If the provider returns a terminal `failed`, `cancelled`, or `incomplete` status, the Vektiss job records a safe error state, releases its reservation, and makes no delivered opportunities.

### Vektiss research brief and ranking

The server builds a compact brief from the existing creator/content profile fields plus durable behavior signals. It intentionally searches broader conversations, not merely the literal industry label.

1. Generate several broad, profile-grounded research lenses: audience problems, adjacent life/business situations, preferred source types, content pillars, and exclusions.
2. Ask one background research operation for a larger source-backed candidate pool than the requested count.
3. Remove unsafe/invalid source URLs, exact canonical URL matches, headline/topic near-duplicates, and stories previously rejected without material change.
4. Rank candidates using configurable deterministic factors: profile relevance, audience-problem fit, expertise/angle fit, source quality/count, recency, source preference, and saved/rejected behavior signals.
5. Persist the best requested count and retain the rest only as un-delivered job candidates if needed for diagnostics—not as customer allowance consumption.

### Refinement behavior

“Another angle,” “more relevant to homebuyers,” and “less controversial” operate on the persisted opportunity facts and sources. They use the normal Vektiss LLM path to create a new **creative angle** without a new web request. A fresh research job is started only when the user explicitly needs new/current factual material.

## E. UI changes

### Navigation

The existing **Create a video / My videos**, **Content Profiles**, and **Creator profile** sections remain. Add one first-class, Pro-gated entry:

```text
Create a video
Discover
My videos
Content Profiles
Creator profile
Avatar library
```

### Discover experience

- Header: “Good morning, [creator]. Here are things your audience may want to hear from you about.”
- Batch control: **Find 10**, **Find 20**, **Find 30**. It shows opportunities remaining this period but never request/API-call counts.
- Progress card: one active job with an accessible status label and a reconnect-safe reload state.
- Opportunity card: title, what happened, why the audience cares, why the creator can credibly speak, recommended angle, optional hook, topic, date/timeliness, source links, and save/reject/refine/create actions.
- “Not for me” opens concise reasons: not relevant, already talked about this, don’t like this topic, too old, not my audience, wrong angle, or other.
- The UI never shows the Perplexity name or asks a customer to connect a research account.

### Script-flow connection

`Create` creates/opens a normal `creator_scripts` draft whose `brief` contains `research_opportunity_id`, the factual source packet, and source URLs. It opens at the existing perspective/draft step, preserving normal script review, video planning, presenter, and video processing behavior.

## F. Security concerns and controls

1. **Credential exposure:** The Perplexity secret stays only in Supabase Function secrets; do not add it to `VITE_*`, deployment build output, repository files, or client telemetry.
2. **Ownership:** Every Edge Function verifies the bearer JWT and profile ownership before access; RLS is a second boundary on all newly persisted customer data.
3. **Prompt/data isolation:** Provider prompts contain only the minimal creator strategy needed for research. No email address, auth token, internal notes unnecessary to research, or another creator’s feedback is included.
4. **Source integrity:** Never accept model-authored URLs. Persist only validated provider-returned result URLs, keep sources with every current claim, distinguish fact summaries from Vektiss angles/inferences, and disclose unavailable/conflicting evidence.
5. **Injection resistance:** Profile fields, source text, and provider snippets are untrusted data. Prompts explicitly prohibit following instructions within them; stored text is rendered as text, not HTML.
6. **Idempotency and allowances:** Repeated clicks/retries use a user-scoped idempotency key. Reservations, completion transitions, and feedback actions are transactional to prevent duplicate jobs or double counting.
7. **Abuse controls:** Enforce batch-size/brief-size limits, entitlement checks, per-user active-job caps, upstream timeouts, safe error codes, and cancellation/retry rules.
8. **Existing security work:** The existing security advisor findings should be remediated separately from this feature; this rollout will not broaden their exposure. Newly created `SECURITY DEFINER` helpers, if any, will set `search_path = ''`, revoke default public execute, and grant the narrow required role only.
9. **Credential incident:** A GitHub personal access token was supplied in the initial request but is not needed because the configured GitHub integration authenticated the clone. It should be revoked and replaced in GitHub immediately, because credentials shared in a chat transcript should be treated as exposed.

## G. API usage and cost instrumentation

### What every provider request records

| Field | Why it matters |
| --- | --- |
| `job_id`, `user_id`, `content_profile_id`, provider and operation | Per-customer and per-batch attribution |
| Perplexity response ID, status, model/preset, timestamps, elapsed time | Reconciliation, retries, and provider troubleshooting |
| Agent response `usage` JSON and returned cost fields | Preserve provider-reported tokens/tool calls/cost verbatim |
| Pricing/version snapshot when a derived estimate is used | Prevent historical reports changing silently when prices change |
| Requested batch, candidate count, accepted count, delivered count | Candidate efficiency and cost per delivered opportunity |
| Failure reason and retry relationship | Failed-call analysis without charging a customer |
| Feedback and script/video conversion events | Save rate, rejection rate, opportunity-to-script, and opportunity-to-video conversion |

Perplexity’s Agent API examples include input/output token details, tool-call usage, and a returned cost object; the integration will retain this response data when present. The Search API is billed per request rather than token usage, so any Search API usage will retain request/configuration metadata and leave dollar cost **unknown** until a pricing snapshot or provider value is available. See [Perplexity Agent API quickstart](https://docs.perplexity.ai/docs/agent-api/quickstart) and [Search API quickstart](https://docs.perplexity.ai/docs/search/quickstart).

### Initial economics outputs

A restricted research-admin query/RPC (and eventually a small admin view) will calculate:

- provider cost per research batch and per delivered opportunity;
- cost per saved/selected opportunity;
- cost per customer and billing period;
- batches per customer, requested/delivered/accepted counts, and average batch size;
- save/rejection/reason rates;
- opportunity → script → completed-video conversion;
- provider error/retry/incomplete rate and unknown-cost count.

No core ranking or entitlement decision depends on a hard-coded Perplexity price. Missing provider cost is reported as **unknown**, not zero.

## Implementation decision record

- **Use Perplexity Agent API background mode for personalized research jobs**, rather than making one Search API request per opportunity or keeping the browser open.
- **Use provider result IDs for source mapping**, rather than trusting model-generated URLs.
- **Reuse `creator_profiles`, `content_profiles`, and `creator_scripts`**, rather than rebuilding creator context or script/video flow.
- **Start with deterministic behavior-aware ranking**, not model training or semantic-vector infrastructure.
- **Keep the feature off until a pilot entitlement is granted**; the initial manual entitlement table is the bridge until subscriptions exist.

## Definition of done for the pilot

1. Two different content profiles produce materially different source-backed opportunity feeds.
2. No customer can access another customer’s research, history, or entitlement state.
3. A failed/invalid provider run creates no delivered-opportunity charge.
4. A selected opportunity opens the existing Creator script workflow with its retained evidence.
5. Saved/rejected/selected behavior is persisted and affects a subsequent rank.
6. Perplexity API use and cost/unknown-cost state are queryable per customer and batch.
7. No Perplexity credential is shipped to or requested from the browser.
