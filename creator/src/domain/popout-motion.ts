// Seek-safe scene choreography: no timers, no duplicate presenter layers.
export function popoutPresenterMotion(time:number,start:number,end:number){
 const duration=end-start,local=Math.max(0,time-start);
 const ease=(x:number)=>{const p=Math.max(0,Math.min(1,x));return p*p*(3-2*p);};
 const entrance=ease(local/.38);
 const exit=duration>=2?ease((time-(end-.38))/.38):0;
 const visible=entrance*(1-exit);
 return {opacity:visible>0?1:0,translateY:(1-visible)*1120,scale:.97+.03*visible};
}
