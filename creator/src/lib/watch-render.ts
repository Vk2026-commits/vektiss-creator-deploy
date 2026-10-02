export function watchRender<T extends {status:string}>(read:()=>Promise<T>,onResult:(value:T)=>void,onError:(error:unknown)=>void,interval=30000,maxChecks=60){
 let active=true;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let checks=0;
 let failures=0;
 async function check(){
  try{
   const value=await read();
   if(!active)return;
   failures=0;onResult(value);
   if(!['pending','processing','submitting'].includes(value.status))return;
  }catch(error){if(!active)return;failures++;onError(error);if(failures>=3)return;}
  if(active&&++checks<maxChecks)timer=setTimeout(()=>void check(),interval);
 }
 void check();
 return()=>{active=false;clearTimeout(timer);};
}
