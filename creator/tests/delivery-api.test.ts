import {beforeEach,afterAll,it,expect,vi} from 'vitest';
import {pcmWav} from '../src/lib/delivery-audio';
import {emptyDelivery} from '../src/domain/delivery';
const state=vi.hoisted(()=>({rows:new Map<string,any>(),handler:null as null|((r:Request)=>Promise<Response>)}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({
 auth:{getUser:async(token:string)=>({data:{user:token==='valid'?{id:'owner'}:null},error:null})},
 rpc:async()=>({data:true,error:null}),
 from:()=>{
  let mode='',payload:any;const filters:Record<string,string>={};
  const q:any={insert:(p:any)=>{mode='insert';payload=p;return q;},update:(p:any)=>{mode='update';payload=p;return q;},eq:(k:string,v:string)=>{filters[k]=v;return q;},then:(resolve:any)=>{
   if(mode==='insert'){if(state.rows.has(payload.id))return Promise.resolve({error:{code:'23505'}}).then(resolve);state.rows.set(payload.id,{...payload,status:'processing'});}
   else for(const row of state.rows.values())if(Object.entries(filters).every(([k,v])=>row[k]===v))Object.assign(row,payload);
   return Promise.resolve({error:null}).then(resolve);
  }};return q;
 },
})}));
vi.stubGlobal('Deno',{env:{get:(key:string)=>key==='APP_ORIGIN'?'https://creator.vektiss.com':key==='CREATOR_OPENAI_API_KEY'?'test-key':'test'},serve:(handler:(r:Request)=>Promise<Response>)=>{state.handler=handler;}});
await import('../supabase/functions/delivery-analysis/index');
const provider=vi.fn();
beforeEach(()=>{state.rows.clear();provider.mockReset();vi.stubGlobal('fetch',provider);provider.mockResolvedValue(new Response(JSON.stringify({usage:{prompt_tokens:10},choices:[{finish_reason:'stop',message:{content:JSON.stringify({...emptyDelivery,pace:'Natural pauses',usable:true})}}]})));});
afterAll(()=>vi.unstubAllGlobals());
async function request(options:{consent?:boolean;token?:string;id?:string;silent?:boolean}={}){
 const samples=new Float32Array(16000*10);if(!options.silent)for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i/10)*.1;
 return new Request('https://test.invalid',{method:'POST',headers:{origin:'https://creator.vektiss.com',Authorization:`Bearer ${options.token??'valid'}`,'x-analysis-consent':String(options.consent??true),'x-request-id':options.id??crypto.randomUUID(),'Content-Type':'audio/wav'},body:pcmWav(samples)});
}
it('requires authentication and consent before any provider request',async()=>{
 expect((await state.handler!(await request({token:'invalid'}))).status).toBe(401);
 expect((await state.handler!(await request({consent:false}))).status).toBe(400);
 expect(provider).not.toHaveBeenCalled();expect(state.rows.size).toBe(0);
});
it('sends audio evidence but only retains operational metadata',async()=>{
 const result=await state.handler!(await request());expect(result.status).toBe(200);
 expect((await result.json()).suggestions.pace).toBe('Natural pauses');
 const payload=JSON.parse(provider.mock.calls[0][1].body);
 expect(payload.store).toBe(false);expect(payload.messages[1].content[0].type).toBe('input_audio');
 const row=[...state.rows.values()][0];expect(row.status).toBe('complete');expect(row.usage).toEqual({prompt_tokens:10});
 for(const key of ['audio','transcript','suggestions','result','file'])expect(row).not.toHaveProperty(key);
});
it('deduplicates an analysis id and never automatically resubmits uncertain calls',async()=>{
 const id=crypto.randomUUID();provider.mockRejectedValueOnce(Error('Network interrupted'));
 expect((await state.handler!(await request({id}))).status).toBe(400);
 expect(state.rows.get(id).status).toBe('uncertain');
 expect((await state.handler!(await request({id}))).status).toBe(409);
 expect(provider).toHaveBeenCalledTimes(1);
});
it('rejects silent clips without charging or storing audio',async()=>{
 expect((await state.handler!(await request({silent:true}))).status).toBe(400);
 expect(provider).not.toHaveBeenCalled();expect(state.rows.size).toBe(0);
});
