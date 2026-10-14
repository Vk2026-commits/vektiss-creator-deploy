-- Three bounded search rounds retain prior candidates while collecting the next
-- round. The original single-round 100 KB limit rejects that checkpoint.
ALTER TABLE public.creator_research_jobs
  DROP CONSTRAINT creator_research_jobs_provider_metadata_check,
  ADD CONSTRAINT creator_research_jobs_provider_metadata_check
    CHECK (jsonb_typeof(provider_metadata) = 'object'
      AND pg_column_size(provider_metadata) < 1000000);
