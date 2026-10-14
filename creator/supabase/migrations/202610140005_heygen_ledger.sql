begin;
-- Read from authenticated HeyGen API Activity, 2026-09-15 through 2026-10-14.
-- Exact video ID matched from each ledger row's thumbnail URL to provider_video_id.
-- Displayed amounts are rounded, not inferred from engine rates.
with ledger(video_id,usd) as (values
 ('ac8b31786ff57b7bf31ca1b309cd5449',2.08),('8454c9dfcfcb8ee21a9307e0d748a84c',1.82),
 ('d2b112dffc4cc8507870afe6892e675e',5.17),('b2cb14dd89b215e7bfe635e4ff9df7be',0.48),
 ('02ff5ddc931c37e728af1da1da67a2ec',7.57),('8601ce882f8c9e43088e27e109bfe3e3',1.33),
 ('d54d7844fa083f648be7118bf3714ebd',2.08),('9afc0b4c127c807f99e80eb0a7364177',5.88),
 ('4389d0220ad0c134b5c49f126f454852',6.00),('d3d60d3afb869a4572ebcd247534f3c3',0.72),
 ('f4b489a5689ed973e0b7ab4489390ebe',5.28),('f3d98e68d1a00951a69638360005002f',1.20),
 ('1e09c41f1679da0c7c54da11e075ed47',6.25),('0c724157586923448af4db2eb7e420dd',0.88),
 ('83568591b3ecbc403e3c4d4a64e6b4d1',0.18),('90e940b4d760037984974cf70b207eee',0.20),
 ('27a031534bcd420b43bb8c7fc0a89885',0.12),('30084c00014413974d24564a2701e3bb',0.12),
 ('6e2a195770b20666d7620fdeb7cfd22b',6.73),('cabf49d63fd77927528a61846a971c8c',5.53),
 ('bc1f1e5929b1d72835e66704f8a53d17',1.67),('23fef0edaeb5d7f85f9b1276c0b29792',2.20),
 ('b23f919b1582935f654ae2494201272a',2.17),('056f829d8140df44fd2b549d90ce3ab4',1.93),
 ('6749ae8f3d7d653e5c4418d6fd3beb91',1.93),('8616f9fd1724ca9ec705fc1d4ea24a36',2.43),
 ('ccae2e062942d8b930f725a115a0e6ad',1.90),('60964813ac154f1e86b2051b54ac31ed',2.52),
 ('6b9fcfd89d76037450cc5768eb248110',2.23),('0809fb4cf0846fada6b5bdede7b18737',2.47),
 ('2f9ab1b570d29425743842886e9570d8',2.40),('25104529db820b4fb1b77f706c3a3c5b',2.20),
 ('b6dabee9f48eae1984c4fb46a9cb6647',2.58),('0a52c00da318827f5030ba7608e77151',3.93),
 ('02ea0ad2623ae7d72afed82ce2a4ddaf',0.58),('ce3d7a87869bbd66a957e2130d4bce9f',0.58),
 ('2f16202b8791b1994ea0049c919968a1',0.58),('ea97bfe80098062401418dc869f8eac3',0.58)
)
update public.creator_presenter_tests r set snapshot=jsonb_set(snapshot,'{cost_reconciliation}',
 coalesce(snapshot->'cost_reconciliation','{}')||jsonb_build_object('reported_usd',l.usd,
 'source','HeyGen API Activity ledger, read 2026-10-14; exact video ID match; displayed USD rounded to cents',
 'reason',null,'ledger_video_id',l.video_id,'ledger_checked_at','2026-10-14'))
from ledger l where r.provider_video_id=l.video_id and r.status='completed';
commit;
