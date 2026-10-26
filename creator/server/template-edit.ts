import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {prepareMedia} from './prepare-media';
import {mediaBinary} from './media-binaries';
import {editSourceSchema,editProposalSchema,editTemplateId,validateEditProposal,editStoryboard} from '../src/domain/edit-templates';
import {DraftError} from './script-draft';
import {readEditBrand} from './edit-brand';
import {editBrandSchema,defaultEditBrand} from '../src/domain/edit-brand';
const exec=promisify(execFile);
const exportId=z.string().regex(/^(?:[a-f0-9-]{36}|[a-f0-9]{64})$/);
export const templateEditOptions=z.object({template:z.union([editTemplateId,z.literal('recommend')]),profileId:z.string().uuid(),exportId:exportId.optional(),brand:editBrandSchema.optional()}).strict();

// root is supplied by the authenticated hosted router, never by the caller.
export async function templateEdit(root:string,file:string,type:string,raw:unknown,authorization:string,c:{supabaseUrl:string;publicKey:string}){
 const options=templateEditOptions.parse(raw);
 const headers={Authorization:authorization,apikey:c.publicKey};
 const owner=await fetch(`${c.supabaseUrl}/rest/v1/content_profiles?id=eq.${options.profileId}&select=id`,{headers,signal:AbortSignal.timeout(15000)});
 if(!owner.ok||(await owner.json()).length!==1)throw new DraftError('Select one of your Content Profiles before editing.');
 const original=options.exportId?resolve(root,'edit/compositions',`${options.exportId}.mp4`):file;
 if(!options.exportId&&!['video/mp4','video/webm'].includes(type))throw Error('VIDEO_FORMAT');
 const folder=resolve(root,'edit/template-plans');await mkdir(folder,{recursive:true,mode:0o700});
 const bytes=await readFile(original),revision=createHash('sha256').update(bytes).digest('hex');
 const sourceFile=resolve(folder,`${revision}.mp4`),sourceCache=resolve(folder,`${revision}.source.json`);
 let source;
 try{source=editSourceSchema.parse(JSON.parse(await readFile(sourceCache,'utf8')));}catch{
  const media=await prepareMedia(createReadStream(original),p=>copyFile(p,sourceFile));
  if(!media.hasAudio)throw new DraftError('This video has no audio track to plan from. Choose a recording with speech.');
  const probe=await exec(mediaBinary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_format','-of','json',sourceFile],{timeout:30000});
  const duration=z.coerce.number().positive().max(180).parse(JSON.parse(probe.stdout).format.duration);
  const audio=resolve(folder,`${revision}.mp3`);
  await exec(mediaBinary('ffmpeg'),['-v','error','-y','-protocol_whitelist','file,pipe','-i',sourceFile,'-vn','-ac','1','-ar','16000','-b:a','32k',audio],{timeout:120000});
  const body=new FormData();body.set('action','story-alignment');body.set('profileId',options.profileId);body.set('file',new Blob([new Uint8Array(await readFile(audio))],{type:'audio/mpeg'}),'speech.mp3');
  let response;try{response=await fetch(`${c.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers,body,signal:AbortSignal.timeout(150000)});}finally{await unlink(audio).catch(()=>{});}
  if(!response.ok)throw new DraftError('Speech timing could not finish. Your original video is unchanged.');
  const transcript=await response.json();
  source=editSourceSchema.parse({assetId:randomUUID(),revision,kind:options.exportId?'avatar':'upload',duration,words:transcript.words.map((w:{start:number;end:number;word:string})=>({start:w.start,end:w.end,text:w.word}))});
  await writeFile(sourceCache,JSON.stringify(source),{mode:0o600});
 }
 source={...source,kind:options.exportId?'avatar' as const:'upload' as const};
 const key=createHash('sha256').update(JSON.stringify([revision,options.template,options.profileId,2,...(options.brand?[options.brand]:[])])).digest('hex');
 const saved=resolve(folder,`${key}.json`);
 try{const cached=JSON.parse(await readFile(saved,'utf8'));validateEditProposal(cached.proposal,source,cached.proposal.templateId);return cached;}catch{/* No usable saved plan. */}
 const body=new FormData();body.set('action','edit-plan');body.set('profileId',options.profileId);body.set('template',options.template);body.set('source',JSON.stringify(source));
 const response=await fetch(`${c.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers,body,signal:AbortSignal.timeout(150000)});
 if(!response.ok)throw new DraftError('The edit plan could not finish. Retry with the same source; its transcript is saved.');
 const output=await response.json(),proposal=editProposalSchema.parse(output.proposal);
 validateEditProposal(proposal,source,options.template==='recommend'?proposal.templateId:options.template);
 const result={id:key,status:'proposal',version:1,savedAt:new Date().toISOString(),brand:options.brand??(await readEditBrand(root)).brand,proposal,storyboard:editStoryboard(proposal,source),sourceKind:source.kind,duration:source.duration,generationId:output.generationId};
 const temp=`${saved}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,saved);
 return result;
}

const planId=z.string().regex(/^[a-f0-9]{64}$/);
export async function readTemplatePlan(root:string,id:unknown){
 return JSON.parse(await readFile(resolve(root,'edit/template-plans',`${planId.parse(id)}.json`),'utf8'));
}
export async function saveTemplatePlan(root:string,raw:unknown){
 const input=z.object({id:planId,baseVersion:z.number().int().positive(),proposal:editProposalSchema,brand:editBrandSchema.optional()}).strict().parse(raw);
 const previous=await readTemplatePlan(root,input.id);
 if((previous.version??1)!==input.baseVersion)throw new DraftError('This plan changed. Reload the saved plan before editing again.');
 // Use the persisted source, never a transcript or filename supplied by the client.
 const revision=planId.parse(previous.proposal.sourceRevision);
 const source=editSourceSchema.parse(JSON.parse(await readFile(resolve(root,'edit/template-plans',`${revision}.source.json`),'utf8')));
 const proposal=validateEditProposal(input.proposal,source,previous.proposal.templateId);
 const result={...previous,brand:input.brand??previous.brand??defaultEditBrand,proposal,storyboard:editStoryboard(proposal,source),version:input.baseVersion+1,savedAt:new Date().toISOString()};
 const saved=resolve(root,'edit/template-plans',`${input.id}.json`),temp=`${saved}.${randomUUID()}.tmp`;
 await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,saved);
 return result;
}
