import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {editSourceSchema,type EditSource} from '../src/domain/edit-templates';
export async function hydrateEditSource(folder:string,source:EditSource){
 // Both planning and rendering need the same saved verbatim evidence.
 try{
  const raw=JSON.parse(await readFile(resolve(folder,`${source.revision}.transcript.json`),'utf8'));
  if(typeof raw.text==='string')return editSourceSchema.parse({...source,transcriptText:raw.text});
 }catch{/* Older sources can still use their validated timed words. */}
 return source;
}
export async function readEditSource(folder:string,revision:string){
 const source=editSourceSchema.parse(JSON.parse(await readFile(resolve(folder,`${revision}.source.json`),'utf8')));
 return hydrateEditSource(folder,source);
}
