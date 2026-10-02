import {supabase} from './supabase';

// Same-origin only: never forward a user's session to a URL returned by a provider.
export async function mediaFetch(path:string,init:RequestInit={}):Promise<Response>{
 if(!/^\/api\/local-capture(?:\/|$)/.test(path))throw Error('Invalid media route.');
 const signal=init.signal??AbortSignal.timeout(20*60*1000);
 async function request(url:string,options:RequestInit={}){
  const headers=new Headers(options.headers);headers.set('X-Creator-Capture','1');
  const session=await supabase?.auth.getSession();
  if(session?.data.session)headers.set('Authorization',`Bearer ${session.data.session.access_token}`);
  return fetch(url,{...options,headers,signal,cache:'no-store'});
 }
 let response=await request(path,init);
 while(response.status===202){
  const job=await response.json();
  if(typeof job.poll!=='string'||!/^\/api\/local-capture\/jobs\/[a-f0-9-]{36}$/.test(job.poll))throw Error('Invalid processing response.');
  await new Promise<void>((resolve,reject)=>{
   signal.throwIfAborted();
   const stop=()=>{clearTimeout(timer);reject(signal.reason);};
   const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},2000);
   signal.addEventListener('abort',stop,{once:true});
  });
  response=await request(job.poll);
 }
 return response;
}
