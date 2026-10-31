import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {z} from 'zod';
import {readTemplatePlan} from './template-edit';
import {editProposalSchema} from '../src/domain/edit-templates';
import {editBrandSchema,defaultEditBrand} from '../src/domain/edit-brand';
import {illustrationScenes,illustrationPrompt,ILLUSTRATION_MODEL,type SavedIllustration,type RenderIllustration} from '../src/domain/edit-illustrations';
import {DraftError} from './script-draft';
const idSchema=z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema=z.object({id:idSchema,version:z.number().int().positive(),profileId:z.string().uuid(),approveImageCharge:z.literal(true)}).strict();
const assetKey=(prompt:string)=>createHash('sha256').update(JSON.stringify([ILLUSTRATION_MODEL,'medium','1024x1024',prompt])).digest('hex');
const validPng=(b:Buffer)=>b.length>=24&&b.length<=12*1024*1024&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.readUInt32BE(16)===1024&&b.readUInt32BE(20)===1024;
export async function generateTemplateIllustrations(root:string,raw:unknown,authorization:string,c:{supabaseUrl:string;publicKey:string},generate?: (prompt:string)=>Promise<Buffer>,onProgress?:(progress:{stage:'illustrating';percent:number})=>void){
 const input=requestSchema.parse(raw),plan=await readTemplatePlan(root,input.id);
 if(plan.version!==input.version)throw new DraftError('This edit changed. Reopen it before creating illustrations.');
 const proposal=editProposalSchema.parse(plan.proposal),brand=editBrandSchema.parse(plan.brand??defaultEditBrand);
 const scenes=illustrationScenes(proposal);if(!scenes.length)throw new DraftError('This template does not need generated illustrations. You can export it with its existing graphics.');
 const folder=resolve(root,'edit/illustrations');await mkdir(folder,{recursive:true,mode:0o700});
 const images:SavedIllustration[]=[];onProgress?.({stage:'illustrating',percent:0});
 for(const {beat,beatIndex,nodeIndex} of scenes){
  const prompt=illustrationPrompt(beat,brand,nodeIndex),assetId=assetKey(prompt),file=resolve(folder,`${assetId}.png`),receipt=resolve(folder,`${assetId}.pending`);
  let cached:Buffer|null=null;try{cached=await readFile(file);}catch{}
  if(!cached||!validPng(cached)){
   try{await writeFile(receipt,new Date().toISOString(),{flag:'wx',mode:0o600});}catch{throw new DraftError('An illustration request is already running or its outcome is uncertain. No duplicate paid request was sent. You can still export with the existing graphics.');}
   let bytes:Buffer;
   try{
    if(generate)bytes=await generate(prompt);
    else{
     const form=new FormData();form.set('action','edit-illustration');form.set('profileId',input.profileId);form.set('prompt',prompt);
     const response=await fetch(`${c.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers:{Authorization:authorization,apikey:c.publicKey},body:form,signal:AbortSignal.timeout(180000)});
     if(!response.ok){if(response.status>=400&&response.status<500)await unlink(receipt).catch(()=>{});throw new DraftError('Image generation could not finish. Your saved edit is unchanged; you can export with its existing graphics.');}
     const data=await response.json();const base64=z.string().min(1).max(17*1024*1024).regex(/^[A-Za-z0-9+/]+={0,2}$/).parse(data.b64_json);bytes=Buffer.from(base64,'base64');
    }
    if(!validPng(bytes))throw new DraftError('The image provider returned an unusable illustration. Your saved video is unchanged.');
    const temp=`${file}.${randomUUID()}.tmp`;await writeFile(temp,bytes,{mode:0o600});await rename(temp,file);await unlink(receipt).catch(()=>{});
   }catch(e){throw e instanceof DraftError?e:new DraftError('Illustration generation was interrupted. Saved images will be reused; uncertain requests will not be charged again automatically.');}
  }
  images.push({beatIndex,nodeIndex,assetId});onProgress?.({stage:'illustrating',percent:Math.floor(images.length/scenes.length*100)});
 }
 const latest=await readTemplatePlan(root,input.id);
 if(latest.version!==input.version)throw new DraftError('The edit changed while creating illustrations. Images are saved for reuse; reopen the current edit.');
 if(JSON.stringify(latest.illustrations)===JSON.stringify(images))return latest;
 const result={...latest,illustrations:images,version:latest.version+1,savedAt:new Date().toISOString()};
 const file=resolve(root,'edit/template-plans',`${input.id}.json`),temp=`${file}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,file);return result;
}
export async function renderIllustrations(root:string,plan:any):Promise<RenderIllustration[]>{
 const proposal=editProposalSchema.parse(plan.proposal),brand=editBrandSchema.parse(plan.brand??defaultEditBrand),result:RenderIllustration[]=[];
 for(const {beat,beatIndex,nodeIndex} of illustrationScenes(proposal)){
  const assetId=assetKey(illustrationPrompt(beat,brand,nodeIndex));
  if(!plan.illustrations?.some((a:SavedIllustration)=>a.beatIndex===beatIndex&&a.nodeIndex===nodeIndex&&a.assetId===assetId))continue;
  const bytes=await readFile(resolve(root,'edit/illustrations',`${assetId}.png`));if(!validPng(bytes))throw new DraftError('A saved illustration could not be read. Your original recording is safe.');
  result.push({beatIndex,nodeIndex,dataUri:`data:image/png;base64,${bytes.toString('base64')}`});
 }
 // Keep previously generated scene-level artwork usable after this upgrade.
 for(const saved of (plan.illustrations??[]) as SavedIllustration[]){
  if(saved.nodeIndex!==undefined||!idSchema.safeParse(saved.assetId).success||!proposal.beats[saved.beatIndex])continue;
  const bytes=await readFile(resolve(root,'edit/illustrations',`${saved.assetId}.png`)).catch(()=>null);
  if(bytes&&validPng(bytes))result.push({beatIndex:saved.beatIndex,dataUri:`data:image/png;base64,${bytes.toString('base64')}`});
 }
 return result;
}
