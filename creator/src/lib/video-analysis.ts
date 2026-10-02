import {mediaFetch} from './media-fetch';
import {supabase} from './supabase';
import {scriptAI} from './script-ai';
import {withDeadline} from './request-deadline';
import {boundarySchema,automaticEnd,type Boundary} from '../domain/source-cut';

export async function serverVideoFrames(blob:Blob,times?:number[]):Promise<{duration:number;frames:{time:number;image:string}[]}>{
 const response=await mediaFetch('/api/local-capture/video-frames',{method:'POST',headers:{'Content-Type':blob.type,...(times?{'X-Frame-Times':JSON.stringify(times)}:{})},body:blob});
 if(!response.ok){const failure=await response.json().catch(()=>null);throw Error(failure?.error??'Could not extract video frames on the server. Your source is retained; please retry.');}
 const result=await response.json();
 if(!Number.isFinite(result.duration)||result.duration<=0||result.duration>180||!Array.isArray(result.frames)||!result.frames.length||result.frames.length>64)throw Error('Invalid server frame response. Please retry.');
 return result;
}
export async function videoFrames(blob:Blob,times?:number[]){return (await serverVideoFrames(blob,times)).frames;}
export async function prepareAnalysis(blob:Blob){
 const response=await mediaFetch('/api/local-capture/prepare-video',{method:'POST',headers:{'Content-Type':blob.type},body:blob});
 if(!response.ok)throw Error('Could not prepare the source. Please retry.');
 return response.blob();
}
export async function detectReaction(blob:Blob,profileId:string,progress:(s:string)=>void){
 progress('Extracting source frames on the server…');
 const {frames,duration}=await serverVideoFrames(blob);
 progress('Preparing source audio…');const prepared=await prepareAnalysis(blob);
 progress('Listening for existing commentary…');
 let transcript='';try{transcript=(await scriptAI('transcribe',profileId,undefined,prepared)).text??'';}catch{/* Visual-only detection discloses missing audio. */}
 async function detect(images:typeof frames):Promise<Boundary>{
  const body=new FormData();body.set('action','video-boundary');body.set('profileId',profileId);body.set('frames',JSON.stringify(images));body.set('transcript',transcript);body.set('audioUnavailable',String(!transcript));
  const {data,error}=await withDeadline(signal=>supabase!.functions.invoke('script-assistant',{body,signal}),90000,'Reaction detection timed out. Your source is retained.');
  if(error)throw Error('Could not check the reaction boundary. Retry or set the cut yourself.');return boundarySchema.parse(data);
 }
 progress('Checking for another creator’s reaction…');let boundary=await detect(frames);
 const coarse=automaticEnd(boundary,duration);
 if(boundary.status==='separate'&&coarse!==null){
  progress('Refining the reaction cut on the server…');
  const times:number[]=[];for(let t=Math.max(0,coarse-4);t<Math.min(duration-.1,coarse+4);t+=.25)times.push(t);
  const refined=await detect(await videoFrames(blob,times));
  boundary=refined.status==='separate'&&refined.end!==null&&refined.end>=times[0]&&refined.end<=times.at(-1)!
   ?refined:{status:'uncertain',end:coarse,confidence:'low',reason:'A reaction was detected, but its exact start needs your review.'};
 }
 return {boundary,duration,end:automaticEnd(boundary,duration)};
}
export async function analyzeVideo(blob:Blob,profileId:string,progress:(s:string)=>void=()=>{},prepared=false){
 if(!supabase)throw Error('Sign in to analyze video.');
 if(blob.size>500*1024*1024)throw Error('Choose a source video up to 500 MB.');
 progress('Extracting selected clip frames on the server…');const frames=await videoFrames(blob);
 if(!prepared){progress('Preparing selected clip audio…');blob=await prepareAnalysis(blob);}
 progress('Listening to the selected clip…');
 let transcript='';let audioUnavailable=false;
 try{const data=await scriptAI('transcribe',profileId,undefined,blob);transcript=data.text??'';}catch{audioUnavailable=true;}
 progress('Understanding the selected clip…');
 const body=new FormData();body.set('action','video-analysis');body.set('profileId',profileId);body.set('frames',JSON.stringify(frames));body.set('transcript',transcript);body.set('audioUnavailable',String(audioUnavailable));
 const {data,error}=await withDeadline(signal=>supabase!.functions.invoke('script-assistant',{body,signal}),90000,'Video analysis timed out. Please retry.');
 if(error||typeof data?.text!=='string'||!data.text.trim())throw Error('Video analysis could not finish. Please retry; your source is still here.');
 return {text:data.text as string};
}
