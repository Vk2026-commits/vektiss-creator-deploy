# Discover Search Quality

The Search Quality screen appears under Admin for accounts with `creator_cost_admin=true` in trusted Supabase app metadata. The `search-quality-admin` Edge Function checks that claim again before any cross-account read or write. Ordinary creators can still skip their own ideas; they cannot list or edit other creators' profiles.

Rules are per Content Profile. A save creates a numbered snapshot; restoring an older snapshot writes a new version. Searches snapshot the effective rules when submitted, so later edits cannot change an in-progress job or old results. Admin edits do not submit provider requests.

Release order:

1. Apply `202610190001_search_quality.sql` to the isolated Creator Supabase project.
2. Deploy `search-quality-admin`, `research-request`, and `research-sync` Edge Functions using the existing import map and exact-origin secrets.
3. Publish the Creator frontend from `glm-creator-test` after the functions are healthy.
4. Sign in as Ricky and verify Search Quality lists Stephen's Content Profiles; confirm a non-admin gets 403 from the admin function. Save and restore a harmless rule in a test profile, then inspect its version history.
5. Review Stephen's recent results, mark specific poor matches, and enter his approved positive/negative safety examples. A deliberate new Discover search is the only step that consumes research-provider resources.

No migration updates existing projects, ideas, or videos. Historical searches retain their original input snapshots. Research reports are recent-history diagnostics, not a guarantee that external platforms will provide ten playable clips.
