import {afterEach,expect,it,vi} from 'vitest';
import {createServer,type Server} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from '../server/media-binaries';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hostedHandler,validateHostingConfig,type HostingConfig} from '../server/hosted-server';
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
let server:Server|undefined,dir='';const realFetch=globalThis.fetch;
afterEach(async()=>{vi.restoreAllMocks();if(server)await new Promise<void>(r=>server!.close(()=>r()));if(dir)await rm(dir,{recursive:true,force:true});});
async function setup(webOrigin?:string){
 dir=await mkdtemp(join(tmpdir(),'creator-host-test-'));await mkdir(join(dir,'public'));await writeFile(join(dir,'public/index.html'),'Creator');
 const config:HostingConfig={origin:'https://creator.example',webOrigin,data:join(dir,'data'),dist:join(dir,'public'),supabaseUrl:'https://project.supabase.co',publicKey:'public',users:[owner]};await mkdir(config.data);
 server=createServer(hostedHandler(config));await new Promise<void>(r=>server!.listen(0,'127.0.0.1',r));
 const address=server.address() as {port:number};
 vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({id:owner}),{status:200}));
 return {config,url:`http://127.0.0.1:${address.port}`,headers:{Authorization:'Bearer test','X-Creator-Capture':'1'}};
}
it('fails closed without an explicit pilot account or HTTPS origin',()=>{
 expect(()=>validateHostingConfig({origin:'http://creator.example',data:'/data',dist:'/app/dist',supabaseUrl:'https://project.supabase.co',publicKey:'public',users:[owner]})).toThrow();
 expect(()=>validateHostingConfig({origin:'https://creator.example',data:'/data',dist:'/app/dist',supabaseUrl:'https://project.supabase.co',publicKey:'public',users:[]})).toThrow();
});
it('serves the app but rejects unauthenticated media and cross-origin requests',async()=>{
 const {url,headers}=await setup();expect((await realFetch(url)).status).toBe(200);
 expect((await realFetch(url+'/api/local-capture/exports',{headers:{'X-Creator-Capture':'1'}})).status).toBe(401);
 expect((await realFetch(url+'/api/local-capture/exports',{headers:{...headers,Origin:'https://evil.example'}})).status).toBe(403);
 expect((await realFetch(url+'/.env')).status).toBe(404);
});
it('accepts the exact configured website origin but still requires authentication',async()=>{
 const {url}=await setup('https://creator.vektiss.com');
 expect((await realFetch(url+'/api/local-capture/exports',{headers:{'X-Creator-Capture':'1',Origin:'https://creator.vektiss.com'}})).status).toBe(401);
 expect((await realFetch(url+'/api/local-capture/exports',{headers:{'X-Creator-Capture':'1',Origin:'https://evil.creator.vektiss.com'}})).status).toBe(403);
});
it('does not allow another account or access to another account’s media',async()=>{
 const {url,headers,config}=await setup();const id='33333333-3333-4333-8333-333333333333';
 await mkdir(join(config.data,other,'.local-captures'),{recursive:true});await writeFile(join(config.data,other,'.local-captures',id+'.video'),'private');
 expect((await realFetch(url+'/api/local-capture/video-background/'+id,{headers})).status).toBe(404);
 vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({id:other}),{status:200}));
 expect((await realFetch(url+'/api/local-capture/exports',{headers})).status).toBe(403);
});
it('releases capacity after rejected requests, and polls failed jobs without repeating work',async()=>{
 const {url,headers}=await setup();const route=url+'/api/local-capture/prepare-video';
 for(let i=0;i<2;i++)expect((await realFetch(route,{method:'POST',headers:{...headers,'Content-Type':'text/plain'},body:'bad'})).status).toBe(415);
 const res=await realFetch(url+'/api/local-capture/video-import',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({url:'file:///private'})});
 expect(res.status).toBe(202);const {poll}=await res.json();let status=202;
 for(let i=0;i<10&&status===202;i++){await new Promise(r=>setTimeout(r,10));status=(await realFetch(url+poll,{headers})).status;}
 expect(status).toBe(422);
});
it('reuses a client-assigned job after a lost response without launching duplicate work',async()=>{
 const {url,headers,config}=await setup();const id='33333333-3333-4333-8333-333333333333';
 const jobs=join(config.data,owner,'jobs');await mkdir(jobs,{recursive:true});
 await writeFile(join(jobs,id+'.json'),JSON.stringify({state:'done',route:'/api/local-capture/script-draft',created:new Date().toISOString(),result:{id:'saved-script'}}));
 const response=await realFetch(url+'/api/local-capture/script-draft',{method:'POST',headers:{...headers,'X-Creator-Job':id,'Content-Type':'application/json'},body:'{}'});
 expect(response.status).toBe(202);const {poll}=await response.json();
 expect(await (await realFetch(url+poll,{headers})).json()).toEqual({id:'saved-script'});
});
it('extracts frames through the authenticated job queue and returns JSON on polling',async()=>{
 const {url,headers}=await setup(),route=url+'/api/local-capture/video-frames';
 expect((await realFetch(route,{method:'POST',headers:{'X-Creator-Capture':'1'}})).status).toBe(401);
 expect((await realFetch(route,{method:'POST',headers:{...headers,'Content-Type':'video/mp4','X-Frame-Times':'[-1]'},body:'bad'})).status).toBe(400);
 const path=join(dir,'clip.mp4');await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=blue:s=32x32:r=25:d=1','-c:v','libx264',path]);
 const response=await realFetch(route,{method:'POST',headers:{...headers,'Content-Type':'video/mp4','X-Frame-Times':'[0,0.5]'},body:await readFile(path)});
 expect(response.status).toBe(202);const {poll}=await response.json();let result:Response=response;
 for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,50));result=await realFetch(url+poll,{headers});if(result.status!==202)break;}
 expect(result.status).toBe(200);const output=await result.json();expect(output.duration).toBe(1);expect(output.frames.map((f:{time:number})=>f.time)).toEqual([0,.5]);
},15000);
