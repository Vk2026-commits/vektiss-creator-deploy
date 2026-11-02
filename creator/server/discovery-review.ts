import {createReadStream} from 'node:fs';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {importVideo} from './social-video';
import {prepareMedia} from './prepare-media';
import {extractVideoFrames} from './video-frames';
import {researchSourceSchema} from '../src/domain/research';
import {metadataReview,sourceReviewSchema,discoveryReportSchema,INSPECTION_LIMIT} from '../src/domain/discovery-pilot';

type Config={supabaseUrl:string;publicKey:string};
export async function reviewDiscovery(root:string,input:unknown,authorization:string,config:Config){
 const {jobId}=z.object({jobId:z.string().uuid()}).strict().parse(input);
 const headers={Authorization:authorization,apikey:config.publicKey};
 async function job(){const r=await fetch(`${config.supabaseUrl}/rest/v1/creator_research_jobs?id=eq.${jobId}&select=id,status,content_profile_id,input_snapshot,provider_metadata`,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('DISCOVERY_OWNER');const [j]=await r.json();if(!j||j.input_snapshot?.discoveryPilot!==true||j.provider_metadata?.stage!=='pilot_inspection')throw Error('DISCOVERY_OWNER');return j;}
 const initial=await job();const sources=z.array(researchSourceSchema).max(INSPECTION_LIMIT).parse(initial.provider_metadata.inspectionSources);const results: {providerSourceId:number;review:ReturnType<typeof sourceReviewSchema.parse>;summary?:string;angle?:string}[]=[];
 const started=Date.now();
 const quickVisual=initial.provider_metadata.fastDelivery===true;
 let next=0;
 async function worker(){while(next<sources.length){const source=sources[next++];const current=await job();if(['cancelled','failed','ready'].includes(current.status))return;
  let review=metadataReview('Media inspection failed; watch the original video.');let summary:string|undefined,angle:string|undefined;
  const dir=await mkdtemp(join(tmpdir(),'creator-discovery-'));const file=join(dir,'source.video');
  async function ai(action:string,frames?:unknown,transcript='',blob?:Buffer){
   const check=await job();if(check.status!=='researching')throw Error('DISCOVERY_STOPPED');
   const body=new FormData();body.set('action',action);body.set('profileId',initial.content_profile_id);body.set('discoveryJobId',jobId);
   if(blob)body.set('file',new Blob([new Uint8Array(blob)],{type:'video/mp4'}),'source.mp4');
   if(frames){body.set('frames',JSON.stringify(frames));body.set('transcript',transcript);body.set('audioUnavailable',String(!transcript));}
   const r=await fetch(config.supabaseUrl+'/functions/v1/script-assistant',{method:'POST',headers,body,signal:AbortSignal.timeout(quickVisual?30000:150000)});const data=await r.json();if(!r.ok)throw Error('DISCOVERY_ANALYSIS_'+r.status);return data;
  }
  try{
   await importVideo(root,source.url,stream=>prepareMedia(stream,p=>copyFile(p,file)),quickVisual?20000:600000);
   review={...review,accessibility:'accessible',reviewedAt:new Date().toISOString()};
   let transcript='';try{if(quickVisual)throw Error('VISUAL_ONLY');const prepared=await prepareMedia(createReadStream(file));if(prepared.hasAudio===false)throw Error('NO_AUDIO');const value=await ai('transcribe',undefined,'',prepared.body);transcript=z.string().max(40000).parse(value.text);if(value.generationId)review.generationIds.push(value.generationId);}catch{review.limitations='Speech was absent or transcription was unavailable.';}
   if(transcript.trim())review={...review,level:'transcript_reviewed',transcript:transcript.slice(0,16000),limitations:'Speech reviewed; earnings claims remain unverified.'};
   const frames=await extractVideoFrames(createReadStream(file),undefined,quickVisual);
   const value=await ai('video-analysis',frames.frames,transcript);const report=discoveryReportSchema.parse(value.report);
   if(value.generationId)review.generationIds.push(value.generationId);
   review={...review,level:'video_sampled',timestamps:frames.frames.map(f=>f.time),observations:report.observations,claims:report.claims,limitations:('Chronological frames were sampled, not continuously watched. Income claims are not independently verified. '+(!transcript?'Speech unavailable. ':'')+report.limitations).slice(0,2000)};
   summary=report.summary;angle=report.angle;
  }catch(e){const code=e instanceof Error?e.message:'VIDEO_EXTRACT';review={...review,reviewedAt:new Date().toISOString(),accessibility:review.accessibility==='accessible'?'accessible':code==='VIDEO_LOGIN'?'blocked':/VIDEO_(LENGTH|SIZE|FORMAT)/.test(code)?'unsupported':'failed',limitations:(review.level==='metadata_only'?code+': could not inspect this clip. Watch the original.':review.limitations+' Visual analysis unavailable: '+code).slice(0,2000)};
  }finally{await rm(dir,{recursive:true,force:true});}
  results.push({providerSourceId:source.providerSourceId,review:sourceReviewSchema.parse(review),summary,angle});
 }
 }
 // Bound parallel downloads, decoding, and provider requests per job.
 await Promise.all(Array.from({length:Math.min(2,sources.length)},()=>worker()));
 return {results,elapsedMs:Date.now()-started,inspectedCount:results.length};
}
