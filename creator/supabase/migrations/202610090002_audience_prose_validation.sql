-- Accept guided audience prose without changing creator-profile tag limits.
CREATE OR REPLACE FUNCTION public.valid_strategy_json(value jsonb, string_keys text[], array_keys text[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE k text; item jsonb; item_limit integer; answer_length integer;
BEGIN
 IF jsonb_typeof(value) IS DISTINCT FROM 'object' OR pg_column_size(value)>65536 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(value)) <> cardinality(string_keys)+cardinality(array_keys) THEN RETURN false; END IF;
 FOREACH k IN ARRAY string_keys LOOP
  IF NOT value ? k OR jsonb_typeof(value->k) IS DISTINCT FROM 'string' OR length(value->>k)>5000 THEN RETURN false; END IF;
 END LOOP;
 FOREACH k IN ARRAY array_keys LOOP
  IF NOT value ? k OR jsonb_typeof(value->k) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(value->k)>20 THEN RETURN false; END IF;
  item_limit := CASE WHEN 'content_pillars'=ANY(array_keys) AND k=ANY(ARRAY['audience_problems','audience_interests','content_pillars','source_topics','reaction_angles','desired_outcomes','tone','things_to_avoid','preferred_ctas']) THEN 3220 ELSE 160 END;
  answer_length := greatest(jsonb_array_length(value->k)-1,0);
  FOR item IN SELECT * FROM jsonb_array_elements(value->k) LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR length(btrim(item #>> '{}')) NOT BETWEEN 1 AND item_limit THEN RETURN false; END IF;
   answer_length := answer_length+length(btrim(item #>> '{}'));
  END LOOP;
  IF item_limit=3220 AND answer_length>3220 THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END;
$$;
