export const SEARCH_BUDGET = { retrievalRequests: 40, reviewedCandidates: 120, concurrentRequests: 3 } as const;
export function deliveryProgress(job: {requested_count:number;delivered_count:number;created_at:string;completed_at?:string|null}, now=Date.now()) {
 const delivered=Math.max(0,Math.min(job.requested_count,job.delivered_count));
 const seconds=Math.max(0,Math.floor(((job.completed_at?Date.parse(job.completed_at):now)-Date.parse(job.created_at))/1000));
 return {percent:job.requested_count>0?Math.floor(delivered/job.requested_count*100):0,delivered,remaining:Math.max(0,job.requested_count-delivered),elapsed:`${Math.floor(seconds/60)}m ${seconds%60}s`};
}
export function refillDecision(input:{delivered:number;requested:number;reviewed:number;requests:number;unused:number;canRetrieve:boolean;providerLimited:boolean;reviewLimited:boolean}) {
 if(input.delivered>=input.requested)return 'complete';
 if(input.reviewLimited)return 'review_provider_limited';
 if(input.reviewed>=SEARCH_BUDGET.reviewedCandidates)return 'review_budget';
 if(input.unused>0)return 'review';
 if(input.providerLimited)return 'retrieval_provider_limited';
 if(input.requests>=SEARCH_BUDGET.retrievalRequests)return 'retrieval_budget';
 return input.canRetrieve?'retrieve':'sources_exhausted';
}
