// HeyGen API pay-as-you-go rates, verified 2026-10-14. Not Studio subscription credits.
export const HEYGEN_RATE_SOURCE='https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained';
export function heygenRate(engine:string,type:string){
 const rates:Record<string,Record<string,number>>={avatar_iii:{digital_twin:.60,photo_avatar:.99,studio_avatar:.99},avatar_iv:{digital_twin:4.83,photo_avatar:2.31,studio_avatar:4.83},avatar_v:{digital_twin:7.20}};
 return rates[engine]?.[type]??null;
}
export function heygenPrice(engine:string,type:string,seconds:number){const rate=heygenRate(engine,type);return rate!==null&&Number.isFinite(seconds)&&seconds>0?rate*seconds/60:null;}
