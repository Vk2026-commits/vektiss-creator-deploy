-- Restore the scoped client write grants used by the Creator onboarding flow.
-- RLS still restricts every row to auth.uid(); generated IDs and timestamps
-- remain database-controlled.
grant insert (user_id, display_name, bio, context),
      update (display_name, bio, context)
on public.creator_profiles to authenticated;

grant insert (user_id, creator_profile_id, name, primary_audience, strategy, cta_default, cta_campaign),
      update (name, primary_audience, strategy, cta_default, cta_campaign)
on public.content_profiles to authenticated;
