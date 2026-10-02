export function suggestedVideoTitle(current:string,suggestion:unknown){
 if(current.trim()&&!/^untitled (video|source brief|brief)$/i.test(current.trim()))return current;
 return typeof suggestion==='string'&&suggestion.trim()?suggestion.trim().slice(0,100):current;
}
