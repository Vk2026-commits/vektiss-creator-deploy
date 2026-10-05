// Published standard token rates, frozen per record. Not a provider invoice.
export const PRICING_VERSION='openai-standard-2026-10-04';
type Usage=Record<string,any>;
export function openAICost(model:string,usage:unknown):number|null {
 if(!usage||typeof usage!=='object')return null;
 const u=usage as Usage;
 if(u.initial||u.rewrite){const a=openAICost(model,u.initial),b=u.rewrite?openAICost(model,u.rewrite):0;return a===null||b===null?null:a+b;}
 const rates=model==='gpt-4o-mini'?[.15,.075,.6]:['gpt-4.1','gpt-4.1-2025-04-14'].includes(model)?[2,.5,8]:model==='gpt-4o-mini-transcribe'?[1.25,1.25,5]:null;
 const input=u.prompt_tokens??u.input_tokens,output=u.completion_tokens??u.output_tokens;
 const cached=u.prompt_tokens_details?.cached_tokens??u.input_token_details?.cached_tokens??0;
 if(!rates||![input,output,cached].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||cached>input)return null;
 return ((input-cached)*rates[0]+cached*rates[1]+output*rates[2])/1e6;
}
export type ProcessingUsage={id:string;project_id:string|null;retry_of?:string|null;operation:string;status:string;elapsed_ms:number|null;retained_bytes:number|null;upload_bytes:number|null;assets:{key:string;bytes:number}[];started_at:string};
export function usageSummary(rows:ProcessingUsage[]){
 const assets=new Map<string,number>();
 const ordered=[...rows].sort((a,b)=>a.started_at.localeCompare(b.started_at));
 for(const row of ordered)for(const asset of row.assets??[])assets.set(asset.key,asset.bytes);
 const operations=new Map<string,number>();
 for(const row of rows)operations.set(row.operation,(operations.get(row.operation)??0)+1);
 return {seconds:rows.reduce((n,r)=>n+(r.elapsed_ms??0)/1000,0),failures:rows.filter(r=>['failed','interrupted'].includes(r.status)).length,retries:rows.filter(r=>r.retry_of).length,
  // Repeated operations can also be deliberate revisions; not asserted to be retries.
  repeatAttempts:[...operations.values()].reduce((n,count)=>n+Math.max(0,count-1),0),
  bytes:[...assets.values()].reduce((n,v)=>n+v,0),uploadBytes:rows.reduce((n,r)=>n+(r.upload_bytes??0),0)};
}
