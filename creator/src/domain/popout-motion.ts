// Keep the presenter inside the safe composition through every graphic change.
// Absolute-time motion is continuous across scene boundaries and backward seeks.
export function popoutPresenterMotion(time:number,_start:number,_end:number){
 return {opacity:1,translateY:Math.sin(time*.7)*8,scale:1+.006*Math.sin(time*.45)};
}
