# Vektiss Creator — authenticated staging export validation

**Run status:** Passed

**Repository state:** `glm-creator-test` at `de6bc00`

**Target:** `vektiss-creator-staging` (`meihyxdibqbqggogseon`) only

**Production access or changes:** None

## Requested export

| Setting | Verified value |
| --- | --- |
| Export mode | Authenticated presenter-only `fullComposition()` endpoint |
| Format | Portrait, 720 × 1280 |
| Presenter placement | Bottom center; custom placement `{ x: 0.5, y: 1, width: 30 }` |
| Presenter size | 30% |
| Framing | Head & Shoulders |
| Input asset | Previously visually approved transparent VP9 WebM supplied for this run |

## Source-integrity verification

The supplied WebM was verified **before upload or use**.

| Check | Result |
| --- | --- |
| SHA-256 | `c018c95379fc7e7b3ed52b84200ad0a2420d969c1d093da40aff050c28889610` — exact match |
| Size | 1,923,337 bytes |
| Video | VP9, 720 × 1280, `alpha_mode=1` |
| Audio | Opus, stereo, 48 kHz |
| Duration | 15.160 seconds |

The verified asset was uploaded to the existing **private** staging bucket `creator-render-assets` under the isolated test user’s prefix. Its unauthenticated direct object request returned **400**; no public object URL was used.

## Staging preparation completed

- Confirmed that the staging project already contained the required private Storage bucket and `creator_avatar_rate_limit` function; no duplicate database objects were created.
- Created a new, isolated, confirmed staging Auth test user. No customer account or customer record was read.
- Configured the required staging-only Edge Function values: `APP_ORIGIN`, `PROVIDER_ENCRYPTION_KEYS`, and `PROVIDER_KEY_VERSION`.
- Deployed the exact `avatar-manager` source and required shared dependencies to staging with `verify_jwt: true`.
- Prepared an isolated local Creator development environment with the staging URL/publishable key and `/usr/bin/ffmpeg` / `/usr/bin/ffprobe`.
- Used the real local `/api/local-capture/full-compose` route, not a mock or direct renderer bypass.

## Authentication and access-control checks

| Check | Result |
| --- | --- |
| Edge Function without a user JWT | **401** |
| Authenticated request from an untrusted Origin | **403** |
| Authenticated user requesting a non-owned presenter test | **404** |
| Local `fullComposition()` route without a session | **400** with `Sign in before creating a video.` |
| Public request to local media route | **403** |
| Authenticated fixture lookup | **200**, returned the staging private signed-media path only to the fixture owner |
| Rate limiter execution | 3 staging test-user events recorded during validation |

## Composition and visual validation

The authenticated `fullComposition()` request returned **200** and emitted the final MP4.

| Composition result | Value |
| --- | --- |
| Composition ID | `5151077d5959658c2c34e49629cb4a7de20c4fdfdd22417369f0aeb6172db967` |
| Detected/cropped source region | `{ x: 222, y: 438, width: 310, height: 221 }` |
| Expected 30% overlay envelope | `x=252`, `y=1126`, `216 × 154`; bottom edge at 1280 |
| Pixel-inspected visible presenter bounds at 7.5 s | `[268, 1126]` through `[455, 1280]` |
| Positioning assessment | Visible presenter lies entirely inside the expected bottom-center envelope |
| Framing assessment | Visual inspection confirms the Head & Shoulders crop, without source-background leakage |

The composition uses the intended neutral presenter-only background. Representative-frame inspection shows a centered lower-frame presenter with the head-and-shoulders crop at the requested compact scale.

## Final MP4 verification

| Check | Result |
| --- | --- |
| File | `5151077d5959658c2c34e49629cb4a7de20c4fdfdd22417369f0aeb6172db967.mp4` |
| SHA-256 | `9ebaf8d42a4715ebffc02c8876e227892e781fd8ef54180f1e15c8ce8fccbe9c` |
| File size | 408,710 bytes |
| Video | H.264 High, `yuv420p`, 720 × 1280, 25 fps |
| Audio | AAC-LC, stereo, 48 kHz |
| Output duration | 15.132 seconds |
| Audio signal | Present; mean −24.7 dB, peak −2.8 dB |
| Source/output duration delta | 0.028 seconds, consistent with container/frame rounding |

## Remaining work

**Nothing remains for this isolated staging export test.** The staging-only test user, fixture row, private asset object, Function deployment, and staging Function secrets remain in place for audit or a repeat test. No paid HeyGen generation was requested or performed, no production project was accessed, and no branch was merged.

The temporary local development server and local credential/configuration files are removed after delivery; the final MP4 and this report remain as the reusable run artifacts.
