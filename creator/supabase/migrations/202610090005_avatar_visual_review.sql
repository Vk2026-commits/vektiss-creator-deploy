-- Alpha-channel validation is not person-only segmentation. Old checks do not
-- attest that furniture is gone; require an explicit review of the saved video.
alter table public.creator_avatar_verifications
 add column visual_approved_at timestamptz;
