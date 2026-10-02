/** Bounded timeline coverage, including the opening and ending of a clip. */
export function sampleTimes(duration:number):number[] {
 if(!Number.isFinite(duration)||duration<=0||duration>180)throw Error('Choose a recorded video up to 3 minutes long.');
 const count=Math.min(48,Math.max(2,Math.ceil(duration)+1));
 return Array.from({length:count},(_,i)=>Math.max(0,(duration-0.01)*i/(count-1)));
}

/** Add close views around the largest visual changes without losing baseline coverage. */
export function refinementTimes(times:number[],changes:number[]):number[] {
 return changes.map((score,i)=>({score,i})).filter(x=>x.i>0&&x.score>0.025)
  .sort((a,b)=>b.score-a.score).slice(0,8)
  .flatMap(({i})=>[times[i-1]+(times[i]-times[i-1])/3,times[i-1]+2*(times[i]-times[i-1])/3]);
}
