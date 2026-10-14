begin;
-- Three corroborating facts: provider API terminal failure, no matching charge
-- in the checked activity ledger, and HeyGen's published no-charge failure rule.
-- This is policy-backed zero, not an invented provider invoice amount.
update public.creator_presenter_tests set snapshot=jsonb_set(snapshot,'{cost_reconciliation}',
 (snapshot->'cost_reconciliation')||jsonb_build_object(
 'reported_usd',0,'reason',null,
 'source','Policy-backed zero: HeyGen API confirms failed; no matching charged activity in Sep 15–Oct 14 ledger; published failure billing policy says failed generations are not charged',
 'pricing_basis','provider-failure-policy',
 'policy_url','https://www.heygen.com/blog/heygen-video-processing-help',
 'reconciled_at','2026-10-14'))
where id='64dcf47e-f677-4f90-a82b-49b83bea26f3'
 and provider_video_id='91349d776c17eba338e11025e97ce15f'
 and status='failed' and snapshot->'cost_reconciliation'->>'provider_status'='failed'
 and snapshot->'cost_reconciliation'->>'reported_usd' is null;
commit;
