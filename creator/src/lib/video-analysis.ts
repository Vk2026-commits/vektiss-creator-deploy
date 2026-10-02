import {mediaFetch} from "./media-fetch";
import {supabase} from './supabase';
import {scriptAI} from './script-ai';
import {withDeadline} from './request-deadline';
import {sampleTimes,refinementTimes} from './video-sampling';
import {boundarySchema,automaticEnd,type Boundary} from '../domain/source-cut';

export async function videoFrames(blob:Blob,selectedTimes?:number[]):Promise<{time:number;image:string}[]> {
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
 const url=URL.createObjectURL(blob);
 const wait=(event:string)=>new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>finish(Error('Could not read video frames. Try an MP4 file.')),10000);
  const ok=()=>finish();const bad=()=>finish(Error('This browser cannot decode the video. Try an MP4 file.'));
  function finish(error?:Error){clearTimeout(timer);video.removeEventListener(event,ok);video.removeEventListener('error',bad);error?reject(error):resolve();}
  video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true});
 });
 try {
  const loaded=wait('loadeddata');video.src=url;await loaded;
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>180)throw Error('Choose a recorded video up to 3 minutes long.');
  const canvas=document.createElement('canvas'),scale=Math.min(1,768/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Video preview is unavailable.');
  const frames:{time:number;image:string}[]=[];
  const times=selectedTimes??sampleTimes(video.duration),changes:number[]=[];
  const thumbnail=document.createElement('canvas');thumbnail.width=32;thumbnail.height=32;
  const small=thumbnail.getContext('2d');if(!small)throw Error('Video preview is unavailable.');
  let previous:Uint8ClampedArray|undefined;
  async function capture(time:number){
   if(Math.abs(video.currentTime-time)>0.001){const seeked=wait('seeked');video.currentTime=time;await seeked;}
   context!.drawImage(video,0,0,canvas.width,canvas.height);
   frames.push({time,image:canvas.toDataURL('image/jpeg',0.65)});
  }
  for(const time of times){
   await capture(time);small.drawImage(video,0,0,32,32);
   const pixels=small.getImageData(0,0,32,32).data;
   let change=0;if(previous)for(let i=0;i<pixels.length;i++)if(i%4!==3)change+=Math.abs(pixels[i]-previous[i]);
   changes.push(change/(32*32*3*255));previous=pixels;
  }
  if(!selectedTimes)for(const time of refinementTimes(times,changes))await capture(time);
  frames.sort((a,b)=>a.time-b.time);
  if(JSON.stringify(frames).length>9*1024*1024)throw Error('Video frames are too large to analyze. Try a lower-resolution copy.');
  return frames;
 }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

export async function prepareAnalysis(blob:Blob){
 const response=await mediaFetch('/api/local-capture/prepare-video',{method:'POST',headers:{'Content-Type':blob.type},body:blob});
 if(!response.ok)throw Error('Could not prepare the source. Please retry.');
 return response.blob();
}
export async function detectReaction(blob:Blob,profileId:string,progress:(s:string)=>void){
 progress('Checking for another creator’s reaction…');
 const prepared=await prepareAnalysis(blob);
 const frames=await videoFrames(prepared);
 const duration=await sourceDuration(blob);
 let transcript='';try{transcript=(await scriptAI('transcribe',profileId,undefined,prepared)).text??'';}catch{/* Visual-only detection must disclose missing audio. */}
 async function detect(images:typeof frames):Promise<Boundary>{
  const body=new FormData();body.set('action','video-boundary');body.set('profileId',profileId);body.set('frames',JSON.stringify(images));body.set('transcript',transcript);body.set('audioUnavailable',String(!transcript));
  const {data,error}=await withDeadline(signal=>supabase!.functions.invoke('script-assistant',{body,signal}),90000,'Reaction detection timed out. Your source is retained.');
  if(error)throw Error('Could not check the reaction boundary. Retry or set the cut yourself.');return boundarySchema.parse(data);
 }
 let boundary=await detect(frames);
 const coarse=automaticEnd(boundary,duration);
 if(boundary.status==='separate'&&coarse!==null){
  progress('Finding the exact reaction cut…');
  const times:number[]=[];for(let t=Math.max(0,coarse-4);t<Math.min(duration-.02,frames.at(-1)!.time,coarse+4);t+=.25)times.push(t);
  const refined=await detect(await videoFrames(prepared,times));
  boundary=refined.status==='separate'&&refined.end!==null&&refined.end>=times[0]&&refined.end<=times.at(-1)!
   ?refined:{status:'uncertain',end:coarse,confidence:'low',reason:'A reaction was detected, but its exact start needs your review.'};
 }
 return {boundary,duration,end:automaticEnd(boundary,duration)};
}
async function sourceDuration(blob:Blob):Promise<number>{
 const video=document.createElement('video'),url=URL.createObjectURL(blob);
 try{return await new Promise<number>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Cannot read source duration.')),10000);
  video.onloadedmetadata=()=>{clearTimeout(timer);Number.isFinite(video.duration)&&video.duration>0&&video.duration<=180?resolve(video.duration):reject(Error('Choose a video up to 3 minutes.'));};
  video.onerror=()=>{clearTimeout(timer);reject(Error('Cannot decode this source.'));};video.src=url;
 });}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}

export async function analyzeVideo(blob:Blob,profileId:string,progress:(s:string)=>void=()=>{},prepared=false) {
 if(!supabase)throw Error('Sign in to analyze video.');
 if(!prepared){
  if(blob.size>500*1024*1024)throw Error('Choose a source video up to 500 MB.');
  progress('Uploading and preparing video…');
  const response=await mediaFetch('/api/local-capture/prepare-video',{method:'POST',headers:{'Content-Type':blob.type,'X-Creator-Capture':'1'},body:blob,signal:AbortSignal.timeout(600000)});
  if(!response.ok){const error=await response.json().catch(()=>null);throw Error(error?.error??'Video preparation failed. Please retry.');}
  blob=await response.blob();
 }
 progress('Following the video from beginning to end…');const frames=await videoFrames(blob);
 progress('Listening to the audio…');
 let transcript='';let audioUnavailable=false;
 try{const data=await scriptAI('transcribe',profileId,undefined,blob);transcript=data.text??'';}catch{audioUnavailable=true;}
 progress('Understanding the visuals and on-screen text…');
 const body=new FormData();body.set('action','video-analysis');body.set('profileId',profileId);body.set('frames',JSON.stringify(frames));body.set('transcript',transcript);body.set('audioUnavailable',String(audioUnavailable));
 const {data,error}=await withDeadline(signal=>supabase!.functions.invoke('script-assistant',{body,signal}),90000,'Video analysis timed out. Please retry.');
 if(error||typeof data?.text!=='string'||!data.text.trim())throw Error('Video analysis could not finish. Please retry; your link is still here.');
 return {text:data.text as string};
}
