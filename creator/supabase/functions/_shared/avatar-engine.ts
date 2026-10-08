export const avatarEngines=['avatar_iii','avatar_iv','avatar_v'] as const;
export function engineEstimate(engine:string,type:string|undefined,seconds:number){
 const rates:Record<string,number>={avatar_iii:.60,avatar_iv:4.83,avatar_v:7.20};
 const rate=type==='digital_twin'?rates[engine]:undefined;
 return {engine,avatar_type:type??'unknown',estimated_seconds:seconds,estimated_cost_usd:rate===undefined?null:Number((seconds/60*rate).toFixed(4)),rate_usd_per_minute:rate??null,basis:'HeyGen Digital Twin pay-as-you-go reference, 2026-10-07; estimated speech duration; not billed usage'};
}
