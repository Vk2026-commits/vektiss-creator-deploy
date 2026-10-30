import {it,expect,vi} from 'vitest';
import {createCreativeService} from '../supabase/functions/_shared/creative-service';
const user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
function harness(){
 const rows:Record<string,any[]>={creator_creative_access:[{user_id:user,enabled:true},{user_id:other,enabled:true}],avatar_profiles:[{id:user,user_id:user,connection_id:user}],creator_creative_assets:[{id:user,user_id:user,connection_id:user,provider_id:'asset'}],creator_creative_jobs:[]};
 const db:any={rpc:async(name:string)=>({data:name==='creator_read_credential'?[{version:1}]:true,error:null}),from:(table:string)=>{
  let filters:((r:any)=>boolean)[]=[],mode='get',value:any,single=false;
  const q:any={select:()=>q,eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q;},neq:(k:string,v:any)=>{filters.push(r=>r[k]!==v);return q;},in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q;},contains:(k:string,v:any)=>{filters.push(r=>Object.entries(v).every(([a,b])=>r[k][a]===b));return q;},order:()=>q,limit:()=>q,single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},insert:(v:any)=>{mode='insert';value=v;return q;},update:(v:any)=>{mode='update';value=v;return q;},then:(resolve:any)=>{
   const all=rows[table]??[];let found=all.filter(r=>filters.every(f=>f(r)));
   if(mode==='insert'){if(all.some(r=>r.id===value.id))return Promise.resolve({error:{code:'23505'}}).then(resolve);const row={created_at:new Date().toISOString(),updated_at:new Date().toISOString(),result:{},...value};all.push(row);found=[row];}
   if(mode==='update')found.forEach(r=>Object.assign(r,value));
   return Promise.resolve({data:single?found[0]??null:found,error:null}).then(resolve);
  }};return q;
 }};
 const data=vi.fn(async(path:string)=>path==='/v3/models/images'?{generation_id:'image-1',status:'pending'}:{status:'completed',images:[{image_url:'https://example.com/result.png'}]});
 const service=createCreativeService(db,{open:async()=> 'server-only'} as any,false,()=>({data}) as any);
 return {service,rows,data};
}
const command:any={action:'image',request_id:user,connection_id:user,avatar_id:user,identities:[user],reference:user,orientation:'portrait',rights:true,paid_consent:true,name:'Office'};
it('persists an image and reuses its request without a second provider charge',async()=>{
 const {service,data,rows}=harness();await service.execute(user,command);await service.execute(user,command);
 expect(data).toHaveBeenCalledTimes(1);expect(data.mock.calls[0][0]).toBe('/v3/models/images');
 expect(rows.creator_creative_jobs).toHaveLength(1);
 expect(rows.creator_creative_jobs[0].input.payload.num_images).toBe(1);
 expect(rows.creator_creative_jobs[0].input.payload.aspect_ratio).toBe('9:16');
});
it('rejects another account reading the job or generating with its avatar/assets',async()=>{
 const {service,data}=harness();await service.execute(user,command);
 await expect(service.execute(other,{action:'refresh',job_id:user})).rejects.toThrow('not available');
 await expect(service.execute(other,{...command,request_id:other})).rejects.toThrow('Choose an avatar');
 expect(data).toHaveBeenCalledTimes(1);
});
it('recovers an uncertain image with the original key and payload',async()=>{
 const {service,data,rows}=harness();await service.execute(user,command);
 Object.assign(rows.creator_creative_jobs[0],{provider_id:null,status:'submission_unknown'});
 await service.execute(user,{action:'refresh',job_id:user});
 expect(data.mock.calls[1]).toEqual(['/v3/models/images','POST',rows.creator_creative_jobs[0].input.payload,user]);
});
