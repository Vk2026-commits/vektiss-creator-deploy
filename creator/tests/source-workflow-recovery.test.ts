import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceWorkflow} from '../server/source-workflow';
vi.mock('../server/prepare-media',()=>({prepareMedia:async(source:{path:string;destroy:()=>void},preserve?:(p:string)=>Promise<void>)=>{source.destroy();if(preserve)await preserve(source.path);return {body:Buffer.from('audio'),type:'video/mp4'};}}));
vi.mock('../server/video-frames',()=>({extractVideoFrames:async(source:{destroy:()=>void})=>{source.destroy();return {duration:30,frames:[{time:0,image:'data:image/jpeg;base64,AAAA'}]};}}));
const profile='11111111-1111-4111-8111-111111111111';
let root='';afterEach(async()=>{vi.restoreAllMocks();if(root)await rm(root,{recursive:true,force:true});});
async function setup(){root=await mkdtemp(join(tmpdir(),'source-workflow-'));await mkdir(join(root,'.local-captures'));const input=join(root,'upload');await writeFile(input,'original');return input;}
const config={supabaseUrl:'https://example.supabase.co',publicKey:'public'};
it('finishes accepted source work without any browser orchestration',async()=>{
 const input=await setup();const actions:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{
  const action=(init!.body as FormData).get('action') as string;actions.push(action);
  return Response.json(action==='transcribe'?{text:'Original speech'}:action==='video-boundary'?{status:'none',end:null,confidence:'high',reason:'Original footage only.'}:{text:'Evidence grounded in the selected original footage.'});
 });
 const result=await sourceWorkflow(root,input,'video/mp4',{},profile,'Bearer user',config);
 expect(result.cut?.end).toBe(30);expect(result.text).toContain('selected original');
 expect(actions).toEqual(['transcribe','video-boundary','video-analysis']);
});
it('persists a reviewable original and waits instead of guessing an uncertain reaction cut',async()=>{
 const input=await setup();const actions:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{
  const action=(init!.body as FormData).get('action') as string;actions.push(action);
  return Response.json(action==='transcribe'?{text:'Speech'}:{status:'uncertain',end:12,confidence:'low',reason:'Review the transition.'});
 });
 const result=await sourceWorkflow(root,input,'video/mp4',{},profile,'Bearer user',config);
 expect(result.waiting).toBe(true);expect(result.original_id).toMatch(/^[a-f0-9-]{36}$/);expect(result.end).toBe(12);
 expect(actions).not.toContain('video-analysis');
});
