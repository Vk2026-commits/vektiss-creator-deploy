// creator_research_jobs.phase is limited to 120 characters.
export function completedSearchPhase(delivered:number,requested:number,round:number,unavailableRound?:number):string {
 const prefix=`${delivered} of ${requested} clips found.`;
 if(delivered>=requested)return prefix;
 return `${prefix} ${round} rounds checked. ${unavailableRound?'A provider round failed.':'Search fell short; this is not a content-availability limit.'}`.slice(0,120);
}

export function filteredSearchPhase():string {
 return 'No new clips passed filters and relevance. Widen dates or lower thresholds; missing data cannot pass.';
}
