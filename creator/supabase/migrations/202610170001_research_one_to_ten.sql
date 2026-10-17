-- Keep historical 20/30-result jobs intact while new requests use 1–10.
alter table public.creator_research_jobs
  drop constraint if exists creator_research_jobs_requested_count_check;

alter table public.creator_research_jobs
  add constraint creator_research_jobs_requested_count_check
  check (requested_count between 1 and 30);
