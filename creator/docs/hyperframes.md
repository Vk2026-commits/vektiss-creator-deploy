# HyperFrames Motion

The fourth Creator style uses pinned HyperFrames 0.8.206 (Apache-2.0) for HTML motion-card exports. Existing three styles and saved plans retain Remotion. This is one curated style, not the entire upstream catalog.

The gallery uses the same trusted HTML factory as export with a sandboxed five-second sample. Portrait and widescreen use saved brand colors and captions. Original audio is preserved. Full preview is optional; there is no eight-second gate.

Only validated plan data enters application-owned HTML; text is escaped. No model-supplied code or remote media URLs are executed. The renderer receives a credential-free environment, private temporary source, one worker, and a timeout. Files are cleaned up. CSP restricts media to local assets. This is not an OS-level network sandbox: CLI font/browser tooling may make upstream requests.

The worker uses the installed dependency, never runtime package installation. Production uses existing Chromium and FFmpeg. The main render path muxes original audio, validates duration and dimensions, checks concurrent plan changes, and caches by saved version/style/brand.

Real export QA: `CREATOR_HYPERFRAMES_QA=1 npx vitest run tests/hyperframes-render.test.ts`. The CLI path override is operator-only for local QA.
