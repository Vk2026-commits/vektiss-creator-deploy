import {mkdir,readFile,writeFile,rename,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {templateDesign,templateDesignInput,type TemplateDesign} from '../src/domain/template-animation';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {readEditBrand} from './edit-brand';

const idSchema=z.string().uuid();
const folder=(root:string)=>resolve(root,'edit/template-designs');
async function atomic(root:string,record:TemplateDesign){const file=resolve(folder(root),`${record.id}.json`),tmp=`${file}.${randomUUID()}.tmp`;await writeFile(tmp,JSON.stringify(record),{mode:0o600});await rename(tmp,file);}
// File-system lock works across processes sharing the mounted account data.
async function locked<T>(root:string,run:()=>Promise<T>){await mkdir(folder(root),{recursive:true,mode:0o700});const lock=resolve(folder(root),'.lock');try{await mkdir(lock);}catch{throw Error('Template workshop is busy. Retry shortly.');}try{return await run();}finally{await rm(lock,{recursive:true,force:true});}}
export async function readTemplateDesign(root:string,id:string){try{return templateDesign.parse(JSON.parse(await readFile(resolve(folder(root),`${idSchema.parse(id)}.json`),'utf8')));}catch{throw Error('Template design not found.');}}
export async function listTemplateDesigns(root:string){const names=await readdir(folder(root)).catch((e)=>{if(e.code==='ENOENT')return [];throw e;});return Promise.all(names.filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(n=>readTemplateDesign(root,n.slice(0,-5))));}
export async function saveTemplateDesign(root:string,raw:unknown){
 const input=z.object({id:idSchema,revision:z.number().int().nonnegative(),design:templateDesignInput}).strict().parse(raw);
 return locked(root,async()=>{
  const all=await listTemplateDesigns(root),previous=all.find(d=>d.id===input.id);
  if(input.revision===0&&previous){if(JSON.stringify(previous.design)===JSON.stringify(input.design))return previous;throw Error('This design ID already exists. Read it before revising.');}
  if((previous?.revision??0)!==input.revision)throw Error('Template changed. Read the latest revision before saving.');
  if(!previous&&all.length>=100)throw Error('This account has reached 100 template designs. Revise an existing design.');
  if(previous&&previous.design.template!==input.design.template)throw Error('Create a separate design for another base template.');
  const saved=templateDesign.parse({...previous,id:input.id,revision:input.revision+1,savedAt:new Date().toISOString(),design:input.design});await atomic(root,saved);return saved;
 });
}
export async function publishTemplateDesign(root:string,raw:unknown){
 const input=z.object({id:idSchema,revision:z.number().int().positive(),reviewedPreview:z.literal(true),publish:z.boolean()}).strict().parse(raw);
 return locked(root,async()=>{
  const record=await readTemplateDesign(root,input.id);if(record.revision!==input.revision)throw Error('Template changed. Review the latest preview before publishing.');
  if(input.publish){for(const other of await listTemplateDesigns(root))if(other.id!==record.id&&other.published?.design.template===record.design.template){delete other.published;await atomic(root,other);}}
  if(input.publish)record.published={revision:record.revision,design:record.design};else delete record.published;
  await atomic(root,record);return record;
 });
}
export async function publishedTemplateAnimations(root:string){return Object.fromEntries((await listTemplateDesigns(root)).filter(d=>d.published).map(d=>[d.published!.design.template,d.published!.design.animation]));}
export async function templateDesignPreview(root:string,id:string,revision:number,aspectRatio:'9:16'|'16:9'='9:16'){
 const record=await readTemplateDesign(root,id);if(record.revision!==revision)throw Error('Template changed. Read the latest revision before previewing.');
 const proposal={...templateSample(record.design.template),aspectRatio,animation:record.design.animation};
 const html=hyperframesProject(templateSampleSource,proposal,(await readEditBrand(root)).brand,true);
 return {id,revision,duration:templateSampleSource.duration,aspectRatio,html,notice:'Illustrative animation preview with placeholder presenter. No customer footage or paid generation. Speech-anchored reveal order is preserved in production.'};
}
