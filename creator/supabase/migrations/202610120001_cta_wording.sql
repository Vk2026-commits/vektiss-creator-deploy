-- Missing wording is natural for backwards compatibility. Do not rewrite
-- saved scripts or their approved selections.
CREATE OR REPLACE FUNCTION public.creator_valid_cta(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(jsonb_typeof(value)='object'
 AND jsonb_typeof(value->'text')='string' AND length(trim(value->>'text')) BETWEEN 1 AND 500
 AND jsonb_typeof(value->'keyword')='string' AND length(value->>'keyword')<=60
 AND jsonb_typeof(value->'offer')='string' AND length(value->>'offer')<=200
 AND jsonb_typeof(value->'delivery')='string' AND length(value->>'delivery')<=300
 AND (NOT (value ? 'wording') OR (jsonb_typeof(value->'wording')='string' AND value->>'wording' IN ('natural','exact'))),false)
$$;
