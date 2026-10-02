# Bunny pilot — deployed 2026-10-02

Creator: https://mc-zdnmms5ls0.bunny.run

- Bunny app: `WWV1BV2bs4oVBWj`; one Miami region, one instance maximum.
- Image: `ghcr.io/vk2026-commits/vektiss-creator:pilot` (initial release `2e66e4d`).
- Private persistent volume: `creator-media`, 10 GB at `/data` ($1/month plus usage).
- Importer: existing `54AEU2i2UD4LTkS`, also capped at one instance.
- Hosted worker requires a verified session and the configured owner allowlist.
- Health 200, unauthenticated media 401, `.env` 404 verified live.
- Supabase redirect added without replacing existing site URL; exact hosted and
  local origins verified for all three Creator functions; unknown origins rejected.
- Sign-in page checked at 390x844. Signed-in upload, volume permissions, import,
  and final download still require an end-to-end test. No paid render was started.
- Pilot supports video sources; legacy article composition remains local-only.
- Source files that exist only on the Mac must be uploaded again from the phone.

Deploy edge functions with `--import-map supabase/functions/deno.json`.
`CREATOR_ADDITIONAL_ORIGINS` allows the exact hosted origin alongside `APP_ORIGIN`.

Approved budget target: USD 10/month; not a hard cap.

Start with one region and one instance. Do not enable automatic multi-region
scaling, purchase an Anycast IP, or turn on automatic balance recharge.
Read actual billing after the pilot before leaving the worker running.

## Cobalt image

Build deploy/cobalt with a trusted Docker builder, publish to an owner-controlled
registry, and configure CREATOR_COBALT_KEY as a secret UUIDv4. This key must remain
server-side. API_URL must be the actual endpoint, and CORS_URL must match the
chosen Creator origin. Never launch the unprotected upstream image publicly.
The wrapper fails closed without a key and sets a five-request/minute key limit.
This is not a spending cap; downloading and bandwidth must also be bounded by
the Creator worker. No cookies or access-control bypasses are configured.

Upstream Cobalt is AGPL-3.0: https://github.com/imputnet/cobalt.
Retain its license and corresponding source, including this wrapper, when
distributing or operating a modified network service.

## Release gates

- Docker is installed and running; the ARM64 importer image builds locally.
- Authentication smoke test passed on 2026-10-01: no key is rejected with
  `error.api.auth.key.missing`; a valid ephemeral key reaches URL validation.
  This does not verify a real TikTok download or access from Bunny's network.
- AMD64 Creator image published through the owner-controlled GitHub registry.
- Verify unauthorized requests fail and the authorized TikTok test succeeds.
- Authenticated hosted media worker, per-user storage, quota checks, single-job
  concurrency and polling are implemented. Retained job outputs count toward the
  storage quota; automatic retention cleanup is not implemented yet.
- Test login, import, layout, consent and MP4 download from a phone.

The hosted app uses its own authenticated server, not the local Vite server.
Keep the pilot owner-only until authenticated end-to-end checks are complete.
