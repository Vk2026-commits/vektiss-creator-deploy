-- Permit profile-specific sourcing constraints used by personalized research.
ALTER TABLE public.content_profiles
  DROP CONSTRAINT IF EXISTS content_profiles_strategy_check;

UPDATE public.content_profiles
SET strategy = strategy || jsonb_build_object(
  'research_screening_criteria', '',
  'research_source_platforms', '[]'::jsonb,
  'research_reference_urls', '[]'::jsonb
)
WHERE NOT (
  strategy ? 'research_screening_criteria'
  AND strategy ? 'research_source_platforms'
  AND strategy ? 'research_reference_urls'
);

ALTER TABLE public.content_profiles
  ADD CONSTRAINT content_profiles_strategy_check
  CHECK (
    valid_strategy_json(
      strategy,
      ARRAY[
        'secondary_audience'::text,
        'additional_context'::text,
        'research_screening_criteria'::text
      ],
      ARRAY[
        'audience_problems'::text,
        'audience_interests'::text,
        'content_pillars'::text,
        'source_topics'::text,
        'reaction_angles'::text,
        'desired_outcomes'::text,
        'tone'::text,
        'things_to_avoid'::text,
        'preferred_ctas'::text,
        'research_source_platforms'::text,
        'research_reference_urls'::text
      ]
    )
  );
