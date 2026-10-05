import {readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
export type CostContext={supabaseUrl:string;publicKey:string;costProjectId?:string};
export async function reportProcessing(config:CostContext,authorization:string,row:Record<string,unknown>){
 const response=await fetch(`${config.supabaseUrl}/rest/v1/creator_processing_usage?on_conflict=id`,{
  method:'POST',headers:{Authorization:authorization,apikey:config.publicKey,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify(row),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('COST_TELEMETRY_PERSISTENCE');
}
export async function mediaInventory(root:string){
 const entries:{key:string;bytes:number;modified:number}[]=[];
 for(const folder of ['.local-captures','edit/compositions']){
  for(const name of await readdir(resolve(root,folder)).catch(()=>[])){
   if(!/\.(video|png|mp4|webm)$/.test(name)||name.includes('.partial.'))continue;
   const info=await stat(resolve(root,folder,name));if(info.isFile())entries.push({key:`${folder}/${name}`,bytes:info.size,modified:info.mtimeMs});
  }
 }
 return entries;
}
