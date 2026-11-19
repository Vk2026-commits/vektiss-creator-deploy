# Creator AI connections (pilot)

Remote URL: `https://creator.vektiss.com/api/mcp`.

Claude: Settings → Connectors → Add custom connector → enter this URL. Sign in with Creator and review the preparation-access consent.

Codex:

```
codex mcp add vektiss --url https://creator.vektiss.com/api/mcp
codex mcp login vektiss
```

Use the same Creator account that owns the profiles and projects. Disconnect under Creator profile → AI connections. A disconnected token is immediately denied; reconnecting requires a new grant.

## Tools

- `list_profiles`, `list_templates`, `list_avatars`, `list_projects`, `get_project`
- `create_draft`: original Studio avatar draft; stable UUID idempotency key required.
- `update_draft`: exact `revision` from `get_project` required; rejects concurrent edits and projects with renders.

Example request: “Use my content profile to prepare a portrait Ranking video. Show me three ideas first. Save the chosen script and ranking labels to Creator, then give me the review link.”

The connected assistant writes the draft. Creator's MCP tools do not call paid AI services. Review rankings and approve the script in Creator, then select the presenter and explicitly confirm generation. Existing reaction drafts retain their source and workflow. Finished videos cannot be changed.

## Operator rollout

1. Apply `supabase/migrations/202611180001_creator_mcp.sql`.
2. Deploy the normal API connector-token guards before enabling OAuth.
3. Set the Supabase custom access-token hook to `pg-functions://postgres/public/creator_mcp_token_hook`. Native tokens retain their role. OAuth tokens receive the isolated `creator_mcp` role, which cannot access public DB APIs.
4. Enable Supabase OAuth server and dynamic registration, consent path `/oauth/consent`.
5. Deploy the hosted worker and frontend rewrites. Configure `SUPABASE_SERVICE_ROLE_KEY` server-side only and `CREATOR_MCP_ENABLED=true` on the worker. Never add the service key to frontend variables.
6. Enable only approved accounts in `creator_mcp_pilots`.
7. Verify OAuth consent, MCP tools, draft reopen, disconnect, and client reconnect. Do not generate paid media during checks.

Disable quickly: set `CREATOR_MCP_ENABLED=false` or disable an account in `creator_mcp_pilots`. Disable OAuth server to stop new OAuth authorizations. Do not roll back the restrictive token role while connector tokens remain valid.

`tests/mcp-database.sql` runs transactional SQL assertions and rolls back. Unit/protocol/HTTP tests: `npx vitest run tests/mcp-*.test.ts tests/video-versions.test.ts`.

Audit records contain account, client, tool, project ID and outcome, never script contents or credentials. Requests are limited to 60 tool calls/account/minute and 128 KiB per HTTP body. Concurrency uses revision checks and account-scoped transaction locks; draft retries use an idempotency key.
