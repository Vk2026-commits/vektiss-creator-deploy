import {supabase} from './supabase';
import {onResume} from './resume-events';
import {recoveryRead,recoveryWrite} from './recovery-storage';

// Same-origin only: never forward a user's session to a URL returned by a provider.
export async function mediaFetch(path:string,init:RequestInit={},recoveryTag?:string,resumeOnly=false,onAccepted?:()=>void):Promise<Response>{
 if(!/^\/api\/local-capture(?:\/|$)/.test(path))throw Error('Invalid media route.');
 const signal=init.signal??new AbortController().signal;
 const owner=(await supabase?.auth.getSession())?.data.session?.user.id;
 const identity=recoveryTag??(['/api/local-capture/full-compose','/api/local-capture/script-draft'].includes(path)&&typeof init.body==='string'?init.body:null);
 const recoveryKey=owner&&identity?`vektiss:media-job:v2:${owner}:${path}:${identity}`:null;
 const pollPattern=/^\/api\/local-capture\/jobs\/[a-f0-9-]{36}$/;
 const stored=recoveryKey?recoveryRead(recoveryKey):null;
 let savedPoll=stored&&pollPattern.test(stored)?stored:null;
 if(resumeOnly&&!savedPoll)throw Error('The upload was interrupted before its job was confirmed. Please select the source again; no paid render was started.');
 const requestId=!savedPoll&&recoveryKey&&import.meta.env.PROD?crypto.randomUUID():null;
 if(requestId){savedPoll=`/api/local-capture/jobs/${requestId}`;recoveryWrite(recoveryKey!,savedPoll);}
 async function wait(){
  signal.throwIfAborted();
  await new Promise<void>((resolve,reject)=>{
   const done=()=>{clearTimeout(timer);off();signal.removeEventListener('abort',stop);resolve();};
   const stop=()=>{clearTimeout(timer);off();signal.removeEventListener('abort',stop);reject(signal.reason);};
   const off=onResume(done),timer=setTimeout(done,2000);
   signal.addEventListener('abort',stop,{once:true});
   if(signal.aborted)stop();
  });
 }
 async function request(url:string,options:RequestInit={}){
  signal.throwIfAborted();
  const headers=new Headers(options.headers);headers.set('X-Creator-Capture','1');
  const session=await supabase?.auth.getSession();
  if(owner&&session?.data.session?.user.id!==owner)throw Error('Your account changed. Reopen your video after signing in.');
  if(session?.data.session)headers.set('Authorization',`Bearer ${session.data.session.access_token}`);
  return fetch(url,{...options,headers,signal:AbortSignal.any([signal,AbortSignal.timeout(options.method==='POST'?600000:30000)]),cache:'no-store'});
 }
 async function read(url:string){
  // A disconnected status read is not a failed job. Only retry GETs.
  for(;;){
   try{const response=await request(url);if(response.status<500)return response;}
   catch(error){if(signal.aborted)throw error;if(!(error instanceof TypeError)&&!(error instanceof DOMException&&error.name==='TimeoutError'))throw error;}
   await wait();
  }
 }
 const headers=new Headers(init.headers);if(requestId)headers.set('X-Creator-Job',requestId);
 let response:Response;
 if(savedPoll&&!requestId){onAccepted?.();response=await read(savedPoll);}
 else if((init.method??'GET').toUpperCase()==='GET')response=await read(path);
 else{
  try{response=await request(path,{...init,headers});}
  catch(error){if(!savedPoll||signal.aborted)throw error;response=await read(savedPoll);}
 }
 while(response.status===202){
  const job=await response.json();
  if(typeof job.poll!=='string'||!pollPattern.test(job.poll))throw Error('Invalid processing response.');
  if(recoveryKey)recoveryWrite(recoveryKey,job.poll);
  onAccepted?.();
  await wait();response=await read(job.poll);
 }
 // Retain successful jobs for reload recovery. A deliberate retry can resubmit
 // a terminal failed export, but never a paid avatar render.
 if(recoveryKey&&!response.ok&&response.status!==401)recoveryWrite(recoveryKey,null);
 return response;
}
