// These events only request status reads; never use them to submit paid work.
export function onResume(callback:()=>void){
 const visible=()=>{if(document.visibilityState!=='hidden')callback();};
 if(typeof window==='undefined')return()=>{};
 window.addEventListener('online',visible);
 window.addEventListener('pageshow',visible);
 document.addEventListener('visibilitychange',visible);
 return()=>{window.removeEventListener('online',visible);window.removeEventListener('pageshow',visible);document.removeEventListener('visibilitychange',visible);};
}
