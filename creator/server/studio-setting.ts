import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {graphicCaptureSchema} from '../src/domain/video-plan';
const record=z.object({version:z.number().int().nonnegative(),background:graphicCaptureSchema.nullable()}).strict();
const locks=new Set<string>();
export async function readStudio(root:string){try{return record.parse(JSON.parse(await readFile(resolve(root,'edit/studio.json'),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:0,background:null};throw e;}}
export async function saveStudio(root:string,raw:unknown){
 const input=z.object({baseVersion:z.number().int().nonnegative(),background:graphicCaptureSchema}).strict().parse(raw);
 if(locks.has(root))throw Error('Studio save is in progress. Retry.');locks.add(root);
 try{const previous=await readStudio(root);if(input.baseVersion!==previous.version)throw Error('Studio changed. Reload before saving.');
  await readFile(resolve(root,'.local-captures',`${input.background.id}.png`));
  const next={version:previous.version+1,background:input.background};const folder=resolve(root,'edit');await mkdir(folder,{recursive:true,mode:0o700});const file=resolve(folder,`studio.${randomUUID()}.tmp`);await writeFile(file,JSON.stringify(next),{mode:0o600});await rename(file,resolve(folder,'studio.json'));return next;
 }finally{locks.delete(root);}
}
