export type MediaQuotaJob={created?:string;route?:string};
const discovery=(route:string)=>route.endsWith('/discovery-review');
// Search inspection must not consume the creator's video-processing allowance.
export function mediaQuotaCount(jobs:MediaQuotaJob[],route:string,day:string){
 return jobs.filter(job=>job.created?.startsWith(day)&&discovery(job.route??'')===discovery(route)).length;
}
export function mediaQuotaMessage(route:string){
 return discovery(route)?'Daily search-inspection limit reached. Video creation remains available. Try searching again tomorrow.':'Daily video-processing limit reached. Try again tomorrow.';
}
