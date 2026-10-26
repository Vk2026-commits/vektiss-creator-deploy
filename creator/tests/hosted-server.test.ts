import {afterEach,expect,it,vi} from 'vitest';
import {createServer,type Server} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from '../server/media-binaries';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyAvatarMedia} from '../server/avatar-verification';
import {hostedHandler,validateHostingConfig,type HostingConfig} from '../server/hosted-server';
vi.mock('node:fs/promises',async importOriginal=>({...await importOriginal<typeof import('node:fs/promises')>(),statfs:vi.fn(async()=>({bavail:10*1024*1024,bsize:4096}))}));
vi.mock('../server/avatar-verification',async importOriginal=>({...await importOriginal<typeof import('../server/avatar-verification')>(),verifyAvatarMedia:vi.fn()}));
const owner='11111111-1111-4111-8111-111111111111';
it('saves brand settings only under the authenticated account and returns them on refresh',async()=>{
 vi.stubEnv('CREATOR_EDIT_STUDIO','true');
 try{
  const {url,headers,config}=await setup();const route=url+'/api/local-capture/template-brand';
  const brand={primary:'#AABBCC',background:'#FFFFFF',text:'#111111',captionStyle:'clean'};
  expect((await realFetch(route,{headers:{'X-Creator-Capture':'1'}})).status).toBe(401);
  const saved=await realFetch(route,{method:'PUT',headers,body:JSON.stringify({baseVersion:0,brand})});expect(saved.status).toBe(200);
  expect((await (await realFetch(route,{headers})).json()).brand).toEqual(brand);
  expect(JSON.parse(await readFile(join(config.data,owner,'edit/brand.json'),'utf8')).version).toBe(1);
  expect((await realFetch(route,{method:'PUT',headers,body:JSON.stringify({baseVersion:0,brand})})).status).toBe(400);
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({id:other}),{status:200}));
  expect((await realFetch(route,{headers})).status).toBe(403);
 }finally{vi.unstubAllEnvs();}
});
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
it('serves cached JPEG posters from the authenticated owner’s finished MP4 only',async()=>{
 const {url,headers,config}=await setup();const id='a'.repeat(64);
 const folder=join(config.data,owner,'edit/compositions');await mkdir(folder,{recursive:true});
 await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=blue:s=32x64:r=25:d=1','-c:v','libx264',join(folder,id+'.mp4')]);
 const route=url+'/api/local-capture/export-poster/'+id;
 expect((await realFetch(route)).status).toBe(403);
 const first=await realFetch(route,{headers});expect(first.status).toBe(200);expect(first.headers.get('content-type')).toBe('image/jpeg');
 const jpeg=Buffer.from(await first.arrayBuffer());expect(jpeg[0]).toBe(255);expect(jpeg[1]).toBe(216);
 expect(Buffer.from(await (await realFetch(route,{headers})).arrayBuffer())).toEqual(jpeg);
 vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({id:other}),{status:200}));
 expect((await realFetch(route,{headers})).status).toBe(403);
},15000);
it('restores a verified avatar preview after an ephemeral container restart without a paid render',async()=>{
 const {url,headers,config}=await setup();const id='33333333-3333-4333-8333-333333333333';
 vi.mocked(verifyAvatarMedia).mockImplementation(async(root,testId,userId,authorization,previewConfig)=>{
  expect(testId).toBe(id);expect(userId).toBe(owner);expect(authorization).toBe('Bearer test');expect(previewConfig).toBe(config);
  const folder=join(root,'avatar-previews');await mkdir(folder,{recursive:true});await writeFile(join(folder,`${id}.png`),Buffer.from([137,80,78,71,13,10,26,10]));
  return {test_id:id};
 });
 const route=url+'/api/local-capture/avatar-preview/'+id;
 expect((await realFetch(route,{headers})).status).toBe(200);
 expect((await realFetch(route,{headers})).headers.get('content-type')).toBe('image/png');
 expect(verifyAvatarMedia).toHaveBeenCalledTimes(1);
});
it.each(['graphic-source','source-resolve'])('saves screenshots through durable %s and serves only the owner’s graphic',async operation=>{
 const {url,headers}=await setup();const path=join(dir,'graphic.png');
 await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=blue:s=64x64','-frames:v','1',path]);
 const route=url+'/api/local-capture/'+operation;
 expect((await realFetch(route,{method:'POST',headers:{...headers,'Content-Type':'image/svg+xml'},body:'<svg/>'})).status).toBe(415);
 const response=await realFetch(route,{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:await readFile(path)});
 expect(response.status).toBe(202);const {poll}=await response.json();let result=response;
 for(let i=0;i<400;i++){await new Promise(r=>setTimeout(r,50));result=await realFetch(url+poll,{headers});if(result.status!==202)break;}
 expect(result.status).toBe(200);const data=await result.json(),capture=operation==='source-resolve'?data.capture:data;expect(capture.source_url).toBe('');
 const saved=await realFetch(url+'/api/local-capture/graphic/'+capture.id,{headers});expect(saved.status).toBe(200);expect(saved.headers.get('content-type')).toBe('image/png');
 expect((await realFetch(url+'/api/local-capture/graphic/'+capture.id)).status).toBe(403);
},30000);
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
