-- CTA columns were added after the original column-scoped profile grants.
-- Existing owner-only RLS and CTA validation constraints remain in effect.
GRANT INSERT (cta_default, cta_campaign), UPDATE (cta_default, cta_campaign)
ON public.content_profiles TO authenticated;
