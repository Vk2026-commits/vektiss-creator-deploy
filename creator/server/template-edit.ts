import {EDIT_PLANNER_VERSION} from '../src/domain/edit-planner-version.ts';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,copyFile,rename,unlink,readdir} from 'node:fs/promises';
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
import {editTranscriptWords} from './edit-transcript';
import {editAspectRatio} from '../src/domain/edit-format';
import {discoverLogos} from './logo-assets';
import {logoBrands,logoSuggestionSchema} from '../src/domain/logo-assets';
const exec=promisify(execFile);
const exportId=z.string().regex(/^(?:[a-f0-9-]{36}|[a-f0-9]{64})$/);
export const templateEditOptions=z.object({template:z.union([editTemplateId,z.literal('recommend')]),profileId:z.string().uuid(),exportId:exportId.optional(),brand:editBrandSchema.optional(),aspectRatio:editAspectRatio.optional()}).strict();

// root is supplied by the authenticated hosted router, never by the caller.
export async function templateEdit(root:string,file:string,type:string,raw:unknown,authorization:string,c:{supabaseUrl:string;publicKey:string}){
 let phase='profile';
 try{
 const options=templateEditOptions.parse(raw);
 const headers={Authorization:authorization,apikey:c.publicKey};
 const owner=await fetch(`${c.supabaseUrl}/rest/v1/content_profiles?id=eq.${options.profileId}&select=id`,{headers,signal:AbortSignal.timeout(15000)});
 if(!owner.ok||(await owner.json()).length!==1)throw new DraftError('Select one of your Content Profiles before editing.');
 const original=options.exportId?resolve(root,'edit/compositions',`${options.exportId}.mp4`):file;
 phase='source';
 if(!options.exportId&&!['video/mp4','video/webm'].includes(type))throw Error('VIDEO_FORMAT');
 const folder=resolve(root,'edit/template-plans');await mkdir(folder,{recursive:true,mode:0o700});
 const bytes=await readFile(original),revision=createHash('sha256').update(bytes).digest('hex');
 const sourceFile=resolve(folder,`${revision}.mp4`),sourceCache=resolve(folder,`${revision}.source.json`);
 let source;
 try{source=editSourceSchema.parse(JSON.parse(await readFile(sourceCache,'utf8')));}catch{
  phase='media';
  const media=await prepareMedia(createReadStream(original),p=>copyFile(p,sourceFile));
  if(!media.hasAudio)throw new DraftError('This video has no audio track to plan from. Choose a recording with speech.');
  const probe=await exec(mediaBinary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_format','-of','json',sourceFile],{timeout:30000});
  const duration=z.coerce.number().positive().max(180).parse(JSON.parse(probe.stdout).format.duration);
  const transcriptCache=resolve(folder,`${revision}.transcript.json`);
  let transcript:unknown;
  try{transcript=JSON.parse(await readFile(transcriptCache,'utf8'));}catch{
  phase='audio';
  const audio=resolve(folder,`${revision}.mp3`);
  await exec(mediaBinary('ffmpeg'),['-v','error','-y','-protocol_whitelist','file,pipe','-i',sourceFile,'-vn','-ac','1','-ar','16000','-b:a','32k',audio],{timeout:120000});
  const body=new FormData();body.set('action','story-alignment');body.set('profileId',options.profileId);body.set('file',new Blob([new Uint8Array(await readFile(audio))],{type:'audio/mpeg'}),'speech.mp3');
  phase='transcription';
  let response;try{response=await fetch(`${c.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers,body,signal:AbortSignal.timeout(150000)});}finally{await unlink(audio).catch(()=>{});}
  if(!response.ok)throw new DraftError('Speech timing could not finish. Your original video is unchanged.');
  transcript=await response.json();
  // Save the provider result before validation, so retries do not pay to transcribe again.
  const temp=`${transcriptCache}.${randomUUID()}.tmp`;
  await writeFile(temp,JSON.stringify(transcript),{mode:0o600});await rename(temp,transcriptCache);
  }
  phase='timing';
  source=editSourceSchema.parse({assetId:randomUUID(),revision,kind:options.exportId?'avatar':'upload',duration,words:editTranscriptWords(transcript,duration)});
  await writeFile(sourceCache,JSON.stringify(source),{mode:0o600});
 }
 source={...source,kind:options.exportId?'avatar' as const:'upload' as const};
 const key=createHash('sha256').update(JSON.stringify([revision,options.template,options.profileId,EDIT_PLANNER_VERSION,options.aspectRatio??'9:16',...(options.brand?[options.brand]:[])])).digest('hex');
 const saved=resolve(folder,`${key}.json`);
 try{const cached=JSON.parse(await readFile(saved,'utf8'));validateEditProposal(cached.proposal,source,cached.proposal.templateId);return cached;}catch{/* No usable saved plan. */}
 const body=new FormData();body.set('action','edit-plan');body.set('profileId',options.profileId);body.set('template',options.template);body.set('source',JSON.stringify(source));
 phase='planning';
 const response=await fetch(`${c.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers,body,signal:AbortSignal.timeout(150000)});
 if(!response.ok)throw new DraftError('The edit plan could not finish. Retry with the same source; its transcript is saved.');
 phase='plan-validation';
 const output=await response.json(),proposal=editProposalSchema.parse({...output.proposal,rendererVersion:2,aspectRatio:options.aspectRatio??'9:16'});
 validateEditProposal(proposal,source,options.template==='recommend'?proposal.templateId:options.template);
 const logos=proposal.templateId==='clean-tech'?await discoverLogos(root,source.words):[];
 const result={id:key,status:'proposal',version:1,savedAt:new Date().toISOString(),brand:options.brand??(await readEditBrand(root)).brand,proposal,logos,storyboard:editStoryboard(proposal,source),sourceKind:source.kind,duration:source.duration,generationId:output.generationId};
 phase='saving';
 const temp=`${saved}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,saved);
 return result;
 }catch(error){
  // Never log speech, bearer tokens, media paths, or provider response bodies.
  console.error('template-edit-failed',{phase,name:error instanceof Error?error.name:'unknown',issues:error instanceof z.ZodError?error.issues.map(i=>({code:i.code,path:i.path})):undefined});
  if(error instanceof DraftError)throw error;
  const messages:Record<string,string>={
   profile:'Could not verify the Content Profile. Sign in and try again.',
   source:'The selected source could not be opened. Select the completed video again or upload the original recording.',
   media:'The video could not be read. Choose an MP4 or WebM with speech, no longer than 3 minutes.',
   audio:'The audio track could not be prepared. Your source is preserved; try an MP4 with a playable audio track.',
   transcription:'Speech timing did not finish. Your source and existing videos are unchanged.',
   timing:'Speech timing needs repair. The transcript is saved; retrying this source will reuse it without another transcription.',
   planning:'The AI edit planner did not finish. Your transcript is saved for retry; no avatar was regenerated.',
   'plan-validation':'The AI edit plan failed validation. Your transcript is saved; no video or avatar was regenerated.',
   saving:'The edit plan could not be saved. Your source and existing videos are unchanged.',
  };
  throw new DraftError(messages[phase]);
 }
}

const planId=z.string().regex(/^[a-f0-9]{64}$/);
export async function listTemplatePlans(root:string){
 const folder=resolve(root,'edit/template-plans');
 const names=await readdir(folder).catch((error)=>{if(error.code==='ENOENT')return [];throw error;});
 const plans=await Promise.all(names.filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).map(async name=>{
  try{
   const saved=await readTemplatePlan(root,name.slice(0,-5));
   const proposal=editProposalSchema.parse(saved.proposal);
   if(saved.id!==name.slice(0,-5))return null;
   return {id:saved.id,savedAt:typeof saved.savedAt==='string'?saved.savedAt:'',templateId:proposal.templateId,title:proposal.beats[0]?.headline||'Untitled edit'};
  }catch{return null;}
 }));
 return plans.filter(p=>p!==null).sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
}
export async function readTemplatePlan(root:string,id:unknown){
 return JSON.parse(await readFile(resolve(root,'edit/template-plans',`${planId.parse(id)}.json`),'utf8'));
}
export async function saveTemplatePlan(root:string,raw:unknown){
 const input=z.object({id:planId,baseVersion:z.number().int().positive(),proposal:editProposalSchema,brand:editBrandSchema.optional(),logos:z.array(z.object({brandId:z.string(),status:z.enum(['pending','approved','omitted','unavailable']),replacementId:z.string().optional()}).strict()).max(8).optional()}).strict().parse(raw);
 const previous=await readTemplatePlan(root,input.id);
 if((previous.version??1)!==input.baseVersion)throw new DraftError('This plan changed. Reload the saved plan before editing again.');
 // Use the persisted source, never a transcript or filename supplied by the client.
 const revision=planId.parse(previous.proposal.sourceRevision);
 const source=editSourceSchema.parse(JSON.parse(await readFile(resolve(root,'edit/template-plans',`${revision}.source.json`),'utf8')));
 const proposal=validateEditProposal(input.proposal,source,previous.proposal.templateId);
 let logos=logoSuggestionSchema.array().max(8).parse(previous.logos??[]);
 if(input.logos){
  if(input.logos.length!==logos.length||new Set(input.logos.map(l=>l.brandId)).size!==logos.length||input.logos.some(l=>!logos.some(p=>p.brandId===l.brandId)))throw new DraftError('Logo suggestions changed. Reload this edit.');
  logos=await Promise.all(logos.map(async savedLogo=>{
   const decision=input.logos!.find(l=>l.brandId===savedLogo.brandId)!;
   if(decision.replacementId&&decision.replacementId!==savedLogo.brandId){
    const replacement=logoBrands.find(b=>b.id===decision.replacementId);
    if(!replacement||logos.some(l=>l.brandId===replacement.id))throw new DraftError('Choose a different supported brand for this logo.');
    const found=await discoverLogos(root,[{text:replacement.aliases[0]}]);
    if(!found[0])throw new DraftError('This replacement could not be identified.');
    return {...found[0],firstWord:savedLogo.firstWord};
   }
   if(decision.status==='approved'&&!savedLogo.assetId)throw new DraftError('This logo is unavailable. Omit it or select a replacement.');
   return {...savedLogo,status:decision.status};
  }));
 }
 if(new Set(logos.map(l=>l.brandId)).size!==logos.length)throw new DraftError('Choose a different replacement for each logo.');
 const latest=await readTemplatePlan(root,input.id);
 if((latest.version??1)!==input.baseVersion)throw new DraftError('This plan changed. Reload the saved plan before editing again.');
 const illustrations=JSON.stringify(input.proposal)===JSON.stringify(previous.proposal)&&JSON.stringify(input.brand??previous.brand)===JSON.stringify(previous.brand)?previous.illustrations:[];
 const result={...previous,illustrations,brand:input.brand??previous.brand??defaultEditBrand,proposal,logos,storyboard:editStoryboard(proposal,source),version:input.baseVersion+1,savedAt:new Date().toISOString()};
 const saved=resolve(root,'edit/template-plans',`${input.id}.json`),temp=`${saved}.${randomUUID()}.tmp`;
 await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,saved);
 return result;
}
