# Bunny pilot — not deployed

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
- Build the host architecture before publishing. An owner-controlled Docker Hub
  or GitHub container registry is not connected yet.
- Verify unauthorized requests fail and the authorized TikTok test succeeds.
- Replace development-only Vite middleware with an authenticated media worker.
- Enforce user ownership on all media, captures, jobs and downloads.
- Put persistent files in private storage; never share the current local directory.
- Add quotas, bounded concurrency, cleanup and job status polling.
- Configure exact hosted origins and Supabase authentication redirects.
- Test login, import, layout, consent and MP4 download from a phone.

Do not publish the local Vite server as the hosted application. Its loopback-only
security assumptions do not apply to a public service. The full app is not yet
ready for a hosted deployment.
