-- Serialize stopping, result writes, and allowance settlement on the job row.
CREATE OR REPLACE FUNCTION public.creator_research_terminal_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE kept integer;
BEGIN
 IF OLD.status IN ('ready','failed','cancelled') THEN RETURN OLD; END IF;
 IF NEW.status IN ('ready','failed','cancelled') AND NEW.reserved_count=0 THEN
  SELECT count(*) INTO kept FROM public.creator_research_opportunities WHERE job_id=OLD.id;
  UPDATE public.creator_research_entitlements SET
   reserved_count=greatest(0,reserved_count-OLD.reserved_count),
   delivered_count=delivered_count+kept,updated_at=now()
   WHERE user_id=OLD.user_id;
  NEW.reserved_count:=0;
  NEW.delivered_count:=kept;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER research_terminal_guard BEFORE UPDATE ON public.creator_research_jobs
FOR EACH ROW EXECUTE FUNCTION public.creator_research_terminal_guard();

CREATE OR REPLACE FUNCTION public.creator_research_result_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE current_status text;
BEGIN
 SELECT status INTO current_status FROM public.creator_research_jobs WHERE id=NEW.job_id FOR UPDATE;
 IF current_status IN ('ready','failed','cancelled') THEN RAISE EXCEPTION 'RESEARCH_TERMINAL'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER research_result_guard BEFORE INSERT ON public.creator_research_opportunities
FOR EACH ROW EXECUTE FUNCTION public.creator_research_result_guard();

CREATE OR REPLACE FUNCTION public.creator_research_stop(p_job_id uuid,p_user_id uuid)
RETURNS public.creator_research_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result public.creator_research_jobs;
BEGIN
 SELECT * INTO result FROM public.creator_research_jobs WHERE id=p_job_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'JOB'; END IF;
 IF result.status NOT IN ('ready','failed','cancelled') THEN
  UPDATE public.creator_research_jobs SET status='cancelled',reserved_count=0,phase='Search stopped',
   error_code=NULL,completed_at=now(),updated_at=now() WHERE id=p_job_id RETURNING * INTO result;
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.creator_research_stop(uuid,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.creator_research_stop(uuid,uuid) TO service_role;
