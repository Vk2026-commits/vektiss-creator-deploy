import {onResume} from './resume-events';
export function watchRender<T extends {status:string}>(read:()=>Promise<T>,onResult:(value:T)=>void,onError:(error:unknown)=>void,interval=30000){
 let active=true,inFlight=false,finished=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 async function check(){
  if(!active||inFlight||finished)return;
  clearTimeout(timer);inFlight=true;
  try{
   const value=await read();
   if(!active)return;
   onResult(value);finished=!['pending','processing','submitting'].includes(value.status);
  }catch(error){if(active)onError(error);}
  finally{inFlight=false;if(active&&!finished)timer=setTimeout(()=>void check(),interval);}
 }
 const off=onResume(()=>void check());void check();
 return()=>{active=false;clearTimeout(timer);off();};
}
