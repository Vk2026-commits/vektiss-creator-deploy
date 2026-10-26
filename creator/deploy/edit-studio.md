# Edit Studio rollout

Status: local implementation, not enabled in production.

Flow: owned upload or completed export → timed transcription → source-grounded structured edit plan → saved graphic labels → eight-second preview → explicit approval → original-audio MP4 export.

## Scope

Three styles plus recommendation: Premium Explainer, Tier List, Walkthrough.
Trusted React/SVG renders diagrams, labels, tier rows, deterministic reveals and word-timed captions. It does not execute model code, create custom photorealistic artwork, extract a presenter matte, inspect screen actions, or synthesize voice. Uploaded/completed footage remains intact. Preview includes only the first eight seconds; users approve that preview and the full storyboard. Rendering uses server resources but no new AI-provider call.

## Enable only after staging verification

- Build frontend with `VITE_EDIT_STUDIO=true`.
- Set `CREATOR_EDIT_STUDIO=true` on the media worker and script-assistant function.
- Deploy script-assistant with its pure domain/planner imports.
- Build the updated worker image containing `render/` and the pinned Remotion packages.
- Check Remotion license eligibility before public activation. Do not automatically purchase a license. Official reference: https://www.remotion.dev/docs/license/pricing
- Worker requires Chromium, FFmpeg, and existing owner-authenticated durable job storage. Existing Docker configuration supplies these. `CREATOR_CHROMIUM_PATH` selects the installed Chromium.
- `CREATOR_REMOTION_MODULES` is a local QA override only; omit in production.

## Verification / remaining release checks

- Unit tests cover plan validation, source ownership, no paid call on save, optimistic version conflict, and preview approval tied to version.
- Opt-in `CREATOR_RENDER_QA=1` integration test renders synthetic private media, checks audio/dimensions/duration, preserves source bytes, and verifies cached preview reuse.
- `node render/qa.mjs` writes short synthetic visual checks to a new temporary folder, never renders customer footage or calls an AI provider.
- Still required: authenticated staging browser walkthrough with the actual hosted worker, mobile review/save/download, Docker/Linux render verification and production rollout.
- Keep feature flags off until these checks pass. Final export is never started by choosing a template or saving a plan.
