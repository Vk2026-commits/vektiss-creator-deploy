/** Pure seek-based motion: pop at the spoken label, then travel on the verdict.
 * No timers or previous-frame state, so scrubbing and parallel rendering agree. */
export function rankingFlight(time:number,introduced:number,verdict:number){
 const start=introduced>=0?Math.min(introduced,verdict):Math.max(0,verdict-.4);
 const travelStart=Math.max(verdict,start+.32);
 const pop=Math.max(0,Math.min(1,(time-start)/.24));
 const p=Math.max(0,Math.min(1,(time-travelStart)/.85));
 const travel=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
 return {visible:time>=start,pop:1-Math.pow(1-pop,3),travel,landed:p===1};
}
