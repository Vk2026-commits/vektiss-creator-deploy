begin;
-- This failure and later success refer to the SAME provider response. The
-- successful event already carries its $0.1096 charge; failure adds no charge.
update public.creator_research_usage failed
set provider_cost_usd=0,pricing_version='same-provider-response-already-accounted',
 request_metadata=coalesce(failed.request_metadata,'{}')||jsonb_build_object(
 'cost_source','No additional charge: the same provider response is charged on the linked successful event',
 'cost_accounted_by',paid.id,'accounted_provider_response_id',paid.provider_response_id)
from public.creator_research_usage paid
where failed.id='fb7e89e6-0f66-4c3f-af20-4939aa1275e8'
 and paid.id='de11a06f-a0d2-439e-bd16-0b30e988344f'
 and paid.job_id=failed.job_id and paid.user_id=failed.user_id
 and paid.provider_response_id=failed.provider_response_id
 and paid.provider_cost_usd=0.1096 and failed.provider_cost_usd is null;
commit;
