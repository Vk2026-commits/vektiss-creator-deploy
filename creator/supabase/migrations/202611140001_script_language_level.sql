-- Optional profile setting; old JSON remains valid and creator context is unchanged.
ALTER TABLE public.content_profiles DROP CONSTRAINT IF EXISTS content_profiles_strategy_check;
ALTER TABLE public.content_profiles ADD CONSTRAINT content_profiles_strategy_check CHECK (
 (NOT strategy ? 'language_level' OR (jsonb_typeof(strategy->'language_level')='string' AND strategy->>'language_level' IN ('simple','everyday','technical')))
 AND public.valid_strategy_json(strategy - 'language_level',
 ARRAY['secondary_audience','additional_context','research_screening_criteria']::text[],
 ARRAY['audience_problems','audience_interests','content_pillars','source_topics','reaction_angles','desired_outcomes','tone','things_to_avoid','preferred_ctas','research_source_platforms','research_reference_urls']::text[])
);
