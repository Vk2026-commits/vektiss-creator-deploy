import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {defaultEditBrand,editBrandSchema} from '../src/domain/edit-brand';

// root comes only from the authenticated router; no caller-supplied account ID.
export async function readEditBrand(root:string){
 try{return z.object({version:z.number().int().nonnegative(),savedAt:z.string(),brand:editBrandSchema}).parse(JSON.parse(await readFile(resolve(root,'edit/brand.json'),'utf8')));}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return {version:0,savedAt:'',brand:defaultEditBrand};}
}
const locks=new Set<string>();
export async function saveEditBrand(root:string,raw:unknown){
 const input=z.object({baseVersion:z.number().int().nonnegative(),brand:editBrandSchema}).strict().parse(raw);
 if(locks.has(root))throw Error('Brand settings are being saved. Retry in a moment.');
 locks.add(root);
 try{
  const previous=await readEditBrand(root);
  if(previous.version!==input.baseVersion)throw Error('Brand settings changed in another window. Reload before saving.');
  const result={version:previous.version+1,savedAt:new Date().toISOString(),brand:input.brand};
  await mkdir(resolve(root,'edit'),{recursive:true,mode:0o700});
  const destination=resolve(root,'edit/brand.json'),temp=`${destination}.${randomUUID()}.tmp`;
  await writeFile(temp,JSON.stringify(result),{mode:0o600});await rename(temp,destination);return result;
 }finally{locks.delete(root);}
}
