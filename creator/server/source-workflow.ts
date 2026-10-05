import {createReadStream} from 'node:fs';
import {copyFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {prepareMedia} from './prepare-media';
import {importVideo} from './social-video';
import {extractVideoFrames} from './video-frames';
import {automaticEnd,boundarySchema} from '../src/domain/source-cut';
import {DraftError} from './script-draft';

type Context={supabaseUrl:string;publicKey:string;costProjectId?:string};
// One durable hosted job owns the whole analysis. The phone only reads its status.
export async function sourceWorkflow(root:string,file:string,type:string,input:unknown,profile:unknown,authorization:string,config:Context){
 const media=resolve(root,'.local-captures');
 const profileId=z.string().uuid().parse(profile);
 const options=z.object({url:z.string().url().optional(),original_id:z.string().uuid().optional(),end:z.number().min(1).max(180).optional()}).parse(input??{});
 let originalId=options.original_id;
 if(!originalId){
  originalId=randomUUID();
  const target=resolve(media,`${originalId}.video`);
  if(options.url){const result=await importVideo(root,options.url,prepareMedia);await writeFile(target,result.body,{mode:0o600});type=result.type;}
  else await prepareMedia(createReadStream(file),path=>copyFile(path,target));
  await writeFile(resolve(media,`${originalId}.mime`),type,{mode:0o600});
 }
 const original=resolve(media,`${originalId}.video`);
 async function ai(action:string,frames?:unknown,transcript='',blob?:Buffer){
  const body=new FormData();body.set('action',action);body.set('profileId',profileId);
  if(config.costProjectId)body.set('projectId',config.costProjectId);
  if(blob)body.set('file',new Blob([new Uint8Array(blob)],{type:'video/mp4'}),'source.mp4');
  if(frames){body.set('frames',JSON.stringify(frames));body.set('transcript',transcript);body.set('audioUnavailable',String(!transcript));}
  const response=await fetch(`${config.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers:{Authorization:authorization,apikey:config.publicKey},body,signal:AbortSignal.timeout(150000)});
  const result=await response.json();if(!response.ok)throw new DraftError('Source analysis could not finish. Your original clip is saved; retry from your source.');
  return result;
 }
 const coarse=await extractVideoFrames(createReadStream(original));
 async function transcript(path:string){
  const prepared=await prepareMedia(createReadStream(path));
  try{return z.string().parse((await ai('transcribe',undefined,'',prepared.body)).text);}catch{return '';}
 }
 let end=options.end,reason='Cut selected by you.';
 let speech='';
 if(end===undefined){
  speech=await transcript(original);
  let boundary=boundarySchema.parse(await ai('video-boundary',coarse.frames,speech));
  const candidate=automaticEnd(boundary,coarse.duration);
  if(boundary.status==='separate'&&candidate!==null){
   const times:number[]=[];for(let t=Math.max(0,candidate-4);t<Math.min(coarse.duration-.1,candidate+4);t+=.25)times.push(t);
   const frames=await extractVideoFrames(createReadStream(original),times);
   const refined=boundarySchema.parse(await ai('video-boundary',frames.frames,speech));
   boundary=refined.status==='separate'&&refined.end!==null&&refined.end>=times[0]&&refined.end<=times.at(-1)!
    ?refined:{status:'uncertain',end:candidate,confidence:'low',reason:'Check the exact point where the existing reaction begins.'};
  }
  const selected=automaticEnd(boundary,coarse.duration);reason=boundary.reason;
  if(selected===null)return {original_id:originalId,duration:coarse.duration,end:boundary.end??coarse.duration,reason,waiting:true};
  end=selected;
 }
 if(end>coarse.duration)throw new DraftError('The selected cut is longer than the source. Adjust the ending.');
 let selectedId=originalId;
 if(end<coarse.duration-.05){
  selectedId=randomUUID();await prepareMedia(createReadStream(original),path=>copyFile(path,resolve(media,`${selectedId}.video`)),end);
  await writeFile(resolve(media,`${selectedId}.mime`),'video/mp4',{mode:0o600});
 }
 const selectedPath=resolve(media,`${selectedId}.video`);
 const frames=selectedId===originalId?coarse:await extractVideoFrames(createReadStream(selectedPath));
 if(selectedId!==originalId||!speech)speech=await transcript(selectedPath);
 const result=await ai('video-analysis',frames.frames,speech);
 const text=z.string().min(1).max(40000).parse(result.text);
 return {text,cut:{original_id:originalId,selected_id:selectedId,duration:coarse.duration,end,reason}};
}
