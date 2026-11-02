export function reviewWaitExpired(startedAt:unknown,now=Date.now()){
 const started=Date.parse(String(startedAt));
 return Number.isFinite(started)&&now-started>=180_000;
}

// One failed content-review batch must not discard the remaining candidate pool.
// Never resubmit the failed request; allow one different batch within existing budgets.
export function contentReviewRecovery(previousFailures:unknown,status:string){
 const previous=typeof previousFailures==='number'&&Number.isFinite(previousFailures)?Math.max(0,Math.floor(previousFailures)):0;
 const failures=status==='completed'?previous:previous+1;
 return {failures,limited:failures>=2};
}
