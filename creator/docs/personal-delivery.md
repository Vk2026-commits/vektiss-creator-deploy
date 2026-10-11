# Personal delivery

The optional reference section is in Creator profile, including first-time setup.
Users can skip, record up to 60 seconds, upload a 10–90 second clip under 100 MB,
or enter preferences manually. References are not voice-cloning enrollment.

## Privacy and approval

The browser decodes the source locally to 16 kHz mono WAV. Only audio is sent to
the authenticated `delivery-analysis` Edge Function after explicit consent. It
validates the PCM duration/size, rate limits, reserves the request ID, and sends
audio to the configured audio-capable model with `store:false`. No source,
transcript, or unapproved suggestions are stored in the app's database or media
storage. Request-local buffers are released after success/failure; provider
retention is governed by the provider's policies, not by `store:false` alone.

Operational status and usage are kept in `creator_delivery_analyses`. Clients
can read only their own status and cannot write records. Failed/uncertain calls
are never retried automatically. Refresh discards unsaved suggestions; the UI
explains that the reference cannot be recovered. Approved preferences are
saved by the existing profile save/RLS flow in `context.delivery` (version 1).

## Script and rendering

New requested drafts use approved preferences only as style guidance. They are
snapshotted into the brief and paid-render snapshot. Existing script text is not
rewritten when preferences change. Source claims and the current offer remain
separate. The voice test uses complete opening and closing sentences, with a
1,200-character cap; its cache includes the text, actual engine, voice and speed.
No unsupported stability/emotion parameters are sent. Test consent, voice
approval and background verification never authorize a full render.

New plans set `ending_hold:1`; old plans retain legacy behavior unless the user
enables the hold under More options. The assembly uses the complete source
duration, pads the last composed frame and audio, and never fades spoken words.
The hold participates in the composition hash but not the paid-render hash.

## Release

1. Apply `202610120001_delivery_analysis.sql` to the dedicated Creator Supabase.
2. Deploy delivery-analysis, avatar-manager and script-assistant using the shared
   import map. Preserve JWT configuration; each function validates the user.
3. Confirm `CREATOR_OPENAI_API_KEY` exists. Optional `CREATOR_DELIVERY_MODEL`
   defaults to `gpt-audio-1.5`; no provider analysis is triggered on deployment.
4. Deploy the compatible media backend before the frontend. Preserve old exports.
5. Run build, unit/media/RLS tests and `node tests/delivery-browser.mjs` against
   port 5186 with mock Supabase URL `https://delivery-test.invalid` and public
   test key. The browser fixture never makes paid calls.

Real audio quality and real-device recording still require a creator-approved
reference analysis and separate approval for potentially paid voice tests. Do
not diagnose cracking from metadata or a transcript alone.
