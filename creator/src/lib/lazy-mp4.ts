import {mediaFetch} from './media-fetch';
import {downloadMP4} from './download-mp4';

// One transfer per mounted export, shared by Play and Download. Never prefetch.
export function lazyMP4(id:string,signal:AbortSignal,onProgress:(received:number,total:number|null)=>void){
 let pending:Promise<string>|undefined;
 let url='';
 signal.addEventListener('abort',()=>{if(url)URL.revokeObjectURL(url);},{once:true});
 return ()=>{
  if(signal.aborted)return Promise.reject(signal.reason);
  if(url)return Promise.resolve(url);
  if(!pending)pending=(async()=>{
   const response=await mediaFetch(`/api/local-capture/exports/${id}`,{signal});
   if(!response.ok||!response.headers.get('content-type')?.startsWith('video/mp4'))throw Error('Could not load the saved MP4. Please retry.');
   const blob=await downloadMP4(response,onProgress);
   signal.throwIfAborted();
   url=URL.createObjectURL(blob);
   return url;
  })().catch(error=>{pending=undefined;throw error;});
  return pending;
 };
}
