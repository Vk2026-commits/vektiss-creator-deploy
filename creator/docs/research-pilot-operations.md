# Personalized Research — Pilot Operations

The database migration installs the feature in a **disabled** state. This prevents accidental public rollout.

## 1. Confirm server-side secrets

Supabase Edge Function secrets must include:

- `CREATOR_PERPLEXITY_API_KEY` — the Vektiss-owned Perplexity project key; never a creator-provided key.
- `CREATOR_OPENAI_API_KEY` — already used by `script-assistant`; also used only for “Change angle” refinements.
- `APP_ORIGIN` / `CREATOR_ADDITIONAL_ORIGINS` — existing exact-origin controls.

`CREATOR_PERPLEXITY_RESEARCH_MODEL` is optional. The provider has a documented default, but setting it explicitly gives operations a controlled model choice.

## 2. Enable the controlled pilot

Run these in the Supabase SQL editor as an administrator after deploying the five research Edge Functions:

```sql
-- Keep this false until functions and secrets have been verified.
update public.creator_research_config
set feature_enabled = true,
    default_monthly_opportunity_limit = 150,
    candidate_multiplier = 2.00,
    updated_at = now()
where id = true;

-- Find the customer account to grant access.
select id, email
from auth.users
where email = 'pilot@example.com';

-- Grant one pilot account a configurable monthly allowance.
select public.creator_research_set_pilot_entitlement(
  'USER_UUID_FROM_THE_QUERY',
  true,
  150,
  'Creator Pro pilot'
);
```

To pause a creator without deleting their behavioral history:

```sql
select public.creator_research_set_pilot_entitlement(
  'USER_UUID', false, 150, 'Pilot paused'
);
```

## 3. Economics query

This query preserves unknown provider costs as `NULL`; it does not turn missing information into zero cost.

```sql
select
  u.email,
  date_trunc('month', ru.created_at) as month,
  count(*) filter (where ru.operation = 'deep_research_complete') as completed_batches,
  sum(ru.accepted_count) filter (where ru.operation = 'deep_research_complete') as delivered_opportunities,
  sum(ru.provider_cost_usd) as known_provider_cost_usd,
  case when sum(ru.accepted_count) filter (where ru.operation = 'deep_research_complete') > 0
    then sum(ru.provider_cost_usd) / sum(ru.accepted_count) filter (where ru.operation = 'deep_research_complete')
  end as known_cost_per_delivered_opportunity,
  count(*) filter (where ru.provider_cost_usd is null and ru.operation = 'deep_research_complete') as completed_batches_with_unknown_cost
from public.creator_research_usage ru
join auth.users u on u.id = ru.user_id
group by u.email, date_trunc('month', ru.created_at)
order by month desc, u.email;
```

## 4. Pilot checks

- Confirm a creator without an entitlement sees the Pro-pilot state instead of research controls.
- Grant two accounts with different profiles; request the same batch size and verify the opportunity feeds differ materially.
- Verify each opportunity’s source links are live, relevant, and saved only from the provider response.
- Reject a category, then request another batch and confirm similarly categorized candidates rank lower.
- Select an opportunity and confirm its factual source packet appears in the regular script editor rather than a separate workflow.
- Inspect `creator_research_jobs` and `creator_research_usage` for every test run. Failed/incomplete runs must have `delivered_count = 0` and their entitlement reservation released.
