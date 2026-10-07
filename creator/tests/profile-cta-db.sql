BEGIN;
DO $$
DECLARE original public.content_profiles; p uuid=gen_random_uuid(); p2 uuid=gen_random_uuid(); c uuid=gen_random_uuid(); s uuid=gen_random_uuid(); s2 uuid=gen_random_uuid(); v uuid=gen_random_uuid(); result jsonb; total integer;
 a jsonb='{"text":"Comment GUIDE for the guide","keyword":"GUIDE","offer":"Guide","delivery":"Manual DM"}'::jsonb;
 d jsonb='{"text":"Follow for tips","keyword":"","offer":"","delivery":""}'::jsonb;
BEGIN
 SELECT * INTO original FROM public.content_profiles LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Test requires a profile'; END IF;
 INSERT INTO public.content_profiles(id,user_id,creator_profile_id,name,primary_audience,strategy,cta_default,cta_campaign)
 VALUES(p,original.user_id,original.creator_profile_id,'CTA transaction test '||p,'Test',original.strategy,d,jsonb_build_object('id',c,'limit',1,'cta',a)),
 (p2,original.user_id,original.creator_profile_id,'CTA isolation test '||p2,'Test',original.strategy,d,NULL);
 INSERT INTO public.creator_scripts(id,user_id,content_profile_id,title,hook,body,cta,brief)
 VALUES(s,original.user_id,p,'Test','','','', '{"stage":"source"}'),(s2,original.user_id,p,'Test 2','','','', '{"stage":"source"}');
 SELECT brief INTO result FROM public.creator_scripts WHERE id=s;
 IF result->'cta_selection'->>'scope'<>'campaign' THEN RAISE EXCEPTION 'Campaign not selected'; END IF;
 UPDATE public.creator_scripts SET brief=brief||'{"stage":"review"}' WHERE id IN(s,s2);
 UPDATE public.creator_scripts SET brief=brief||'{"production":{"approved_at":"2026-10-07T00:00:00Z"}}' WHERE id=s;
 UPDATE public.creator_scripts SET title='Retry is not another approval' WHERE id=s;
 SELECT count(*) INTO total FROM public.creator_cta_usage WHERE profile_id=p;
 IF total<>1 THEN RAISE EXCEPTION 'Duplicate approval counted'; END IF;
 BEGIN
  UPDATE public.creator_scripts SET brief=brief||'{"production":{"approved_at":"2026-10-07T00:00:00Z"}}' WHERE id=s2;
  RAISE EXCEPTION 'Exhausted campaign was approved';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'CTA_EXPIRED:%' THEN RAISE; END IF; END;
 UPDATE public.creator_scripts SET brief='{"stage":"source"}' WHERE id=s2;
 SELECT brief INTO result FROM public.creator_scripts WHERE id=s2;
 IF result->'cta_selection'->>'scope'<>'default' THEN RAISE EXCEPTION 'Default not restored after campaign'; END IF;
 INSERT INTO public.creator_scripts(id,user_id,content_profile_id,title,hook,body,cta,brief)
 VALUES(v,original.user_id,p2,'Isolated','','','',jsonb_build_object('stage','source','cta_override',a));
 -- An old worker omits the new fields. Video-specific CTA must survive.
 UPDATE public.creator_scripts SET brief='{"stage":"source"}' WHERE id=v;
 SELECT brief INTO result FROM public.creator_scripts WHERE id=v;
 IF result->'cta_selection'->>'scope'<>'video' THEN RAISE EXCEPTION 'Override lost through legacy worker'; END IF;
 UPDATE public.creator_scripts SET brief='{"stage":"source","cta_override":null}' WHERE id=v;
 SELECT brief INTO result FROM public.creator_scripts WHERE id=v;
 IF result->'cta_selection'->>'scope'<>'default' THEN RAISE EXCEPTION 'Audience isolation or explicit clear failed'; END IF;
 SELECT count(*) INTO total FROM public.creator_cta_usage WHERE profile_id=p2;
 IF total<>0 THEN RAISE EXCEPTION 'Audience usage leaked'; END IF;
 BEGIN
  UPDATE public.content_profiles SET cta_campaign='{"id":"bad","limit":999}' WHERE id=p;
  RAISE EXCEPTION 'Malformed campaign accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.creator_cta_usage'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Missing RLS'; END IF;
END $$;
ROLLBACK;
SELECT 'Campaign selection, exhaustion, repeat approval, audience isolation, legacy-worker preservation, explicit clear, JSON validation and RLS enabled passed; all fixtures rolled back.' AS result;
