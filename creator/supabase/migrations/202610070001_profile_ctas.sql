ALTER TABLE public.content_profiles ADD COLUMN IF NOT EXISTS cta_default jsonb;
ALTER TABLE public.content_profiles ADD COLUMN IF NOT EXISTS cta_campaign jsonb;
CREATE OR REPLACE FUNCTION public.creator_valid_cta(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(jsonb_typeof(value)='object'
 AND jsonb_typeof(value->'text')='string' AND length(trim(value->>'text')) BETWEEN 1 AND 500
 AND jsonb_typeof(value->'keyword')='string' AND length(value->>'keyword')<=60
 AND jsonb_typeof(value->'offer')='string' AND length(value->>'offer')<=200
 AND jsonb_typeof(value->'delivery')='string' AND length(value->>'delivery')<=300,false)
$$;
ALTER TABLE public.content_profiles ADD CONSTRAINT content_profiles_cta_default_check
 CHECK(cta_default IS NULL OR public.creator_valid_cta(cta_default));
ALTER TABLE public.content_profiles ADD CONSTRAINT content_profiles_cta_campaign_check
 CHECK(cta_campaign IS NULL OR coalesce(
 jsonb_typeof(cta_campaign)='object'
 AND (cta_campaign->>'id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 AND jsonb_typeof(cta_campaign->'limit')='number'
 AND (cta_campaign->>'limit') ~ '^([1-9][0-9]?|100)$'
 AND public.creator_valid_cta(cta_campaign->'cta'),false));
CREATE TABLE IF NOT EXISTS public.creator_cta_usage (
 script_id uuid PRIMARY KEY REFERENCES public.creator_scripts(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.content_profiles(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_cta_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY cta_usage_owner_read ON public.creator_cta_usage FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.creator_cta_usage TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.creator_cta_usage FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.creator_apply_cta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.content_profiles; selected jsonb; used integer; campaign uuid; approved boolean;
BEGIN
 SELECT * INTO p FROM public.content_profiles WHERE id=NEW.content_profile_id AND user_id=NEW.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE'; END IF;
 IF NEW.brief->'cta_override' IS NOT NULL AND NEW.brief->'cta_override'<>'null'::jsonb AND NOT public.creator_valid_cta(NEW.brief->'cta_override') THEN
   RAISE EXCEPTION 'Invalid video CTA';
 END IF;
 -- Older processing workers do not know this field. Omission preserves it;
 -- explicit JSON null clears it, allowing rolling frontend/worker releases.
 IF TG_OP='UPDATE' AND NEW.content_profile_id=OLD.content_profile_id AND NOT (NEW.brief ? 'cta_override') AND OLD.brief ? 'cta_override' THEN
   NEW.brief=NEW.brief||jsonb_build_object('cta_override',OLD.brief->'cta_override');
 END IF;
 -- Never trust a supplied campaign selection. Resolve it from the owned profile.
 IF TG_OP='UPDATE' AND NEW.content_profile_id=OLD.content_profile_id AND NEW.brief->>'stage'='review' THEN
   selected=OLD.brief->'cta_selection';
 ELSE
   IF NEW.brief->'cta_override' IS NOT NULL AND NEW.brief->'cta_override'<>'null'::jsonb THEN
     selected=jsonb_build_object('cta',NEW.brief->'cta_override','scope','video','campaign_id',NULL);
   ELSIF p.cta_campaign IS NOT NULL AND p.cta_campaign<>'null'::jsonb THEN
     campaign=(p.cta_campaign->>'id')::uuid;
     SELECT count(*) INTO used FROM public.creator_cta_usage WHERE profile_id=p.id AND campaign_id=campaign;
     IF used<(p.cta_campaign->>'limit')::int THEN selected=jsonb_build_object('cta',p.cta_campaign->'cta','scope','campaign','campaign_id',campaign); END IF;
   END IF;
   IF selected IS NULL AND p.cta_default IS NOT NULL AND p.cta_default<>'null'::jsonb THEN
     selected=jsonb_build_object('cta',p.cta_default,'scope','default','campaign_id',NULL);
   END IF;
 END IF;
 NEW.brief=NEW.brief-'cta_selection';
 IF selected IS NOT NULL AND selected<>'null'::jsonb THEN NEW.brief=NEW.brief||jsonb_build_object('cta_selection',selected); END IF;
 approved=coalesce(NEW.brief->'production'->>'approved_at','')<>'';
 IF approved AND selected->>'scope'='campaign' AND NOT EXISTS(SELECT 1 FROM public.creator_cta_usage WHERE script_id=NEW.id) THEN
   campaign=(selected->>'campaign_id')::uuid;
   SELECT count(*) INTO used FROM public.creator_cta_usage WHERE profile_id=p.id AND campaign_id=campaign;
   IF p.cta_campaign IS NULL OR p.cta_campaign->>'id' IS DISTINCT FROM campaign::text OR used>=(p.cta_campaign->>'limit')::int THEN
     RAISE EXCEPTION 'CTA_EXPIRED: This temporary CTA changed or finished. Regenerate this draft before approving.';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.creator_count_cta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(NEW.brief->'production'->>'approved_at','')<>'' AND NEW.brief->'cta_selection'->>'scope'='campaign' THEN
 INSERT INTO public.creator_cta_usage(script_id,profile_id,user_id,campaign_id)
 VALUES(NEW.id,NEW.content_profile_id,NEW.user_id,(NEW.brief->'cta_selection'->>'campaign_id')::uuid) ON CONFLICT(script_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_apply_cta BEFORE INSERT OR UPDATE ON public.creator_scripts FOR EACH ROW EXECUTE FUNCTION public.creator_apply_cta();
CREATE TRIGGER creator_count_cta AFTER INSERT OR UPDATE ON public.creator_scripts FOR EACH ROW EXECUTE FUNCTION public.creator_count_cta();
REVOKE ALL ON FUNCTION public.creator_apply_cta(),public.creator_count_cta() FROM PUBLIC;
