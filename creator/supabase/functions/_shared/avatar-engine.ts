import {heygenRate} from '../../../src/domain/heygen-pricing.ts';
export const avatarEngines=['avatar_iii','avatar_iv','avatar_v'] as const;
export function engineEstimate(engine:string,type:string|undefined,seconds:number){
 const rate=heygenRate(engine,type??'unknown');
 return {engine,avatar_type:type??'unknown',estimated_seconds:seconds,estimated_cost_usd:rate===null?null:Number((seconds/60*rate).toFixed(4)),rate_usd_per_minute:rate,basis:'HeyGen API pay-as-you-go reference, verified 2026-10-14; estimated speech duration; not billed usage'};
}
