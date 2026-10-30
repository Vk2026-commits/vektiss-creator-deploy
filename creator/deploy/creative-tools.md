# Creative tools rollout

Avatar Looks, Brand Kit, and AI-produced video use the existing encrypted HeyGen connection through creative-manager. No provider credential reaches the browser.

Apply the 202610300001 migration and deploy creative-manager with its import map and internal JWT authentication before publishing the Creator image. Default access is off. Enable Ricky using creator_creative_access; CREATOR_CREATIVE_ENABLED=true enables all accounts only after pilot verification.

Paid provider generations have not been run. Obtain a separate sample budget before image, avatar, storyboard, revision, or video generation. Reference preset provenance is in public/look-presets/README.md.

Pilot checks: Avatar Library references, identity permission, both orientations; existing kit preview and missing-role handling; approved script handoff; storyboard revision and explicit render; reload recovery; video playback/download/Edit Studio; account isolation.

Frontend and hosted builds pass. New contract/provider/database tests pass. Full suite: 639 passed, 6 skipped, two pre-existing avatar-engine pricing expectations fail (expected null, implementation returns long-script prices). Those files are unchanged.

Images/imports recover with saved idempotency keys within 23 hours. Uncertain video/avatar submissions are never blindly replayed. Per-storyboard-turn uniqueness prevents duplicate instructions. Refresh reads provider status to renew media links. Existing templates and avatars remain available.
