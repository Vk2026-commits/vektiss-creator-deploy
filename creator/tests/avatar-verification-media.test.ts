import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mediaBinary} from '../server/media-binaries';
import {verifyAvatarMedia} from '../server/avatar-verification';
import {publicResource} from '../server/public-network';
vi.mock('../server/public-network',()=>({publicResource:vi.fn()}));
it('verifies synthetic VP9 alpha, creates private PNG, and reuses cached output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'avatar-verification-'));
 const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
 try{
  const file=join(root,'synthetic.webm');
  await promisify(execFile)(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i',"color=red:s=128x128:r=10:d=1,format=rgba,geq=r=255:g=0:b=0:a='if(lt(pow((X-64)/32,2)+pow((Y-64)/55,2),1),255,0)'",'-c:v','libvpx-vp9','-pix_fmt','yuva420p',file]);
  vi.mocked(publicResource).mockResolvedValue({status:200,body:await readFile(file)} as any);
  vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({id,user_id:user,status:'completed',snapshot:{scope:'test'},video_url:'https://files.heygen.ai/test.webm'})));
  const result:any=await verifyAvatarMedia(root,id,user,'Bearer test',{supabaseUrl:'https://project.supabase.co',publicKey:'public'});
  expect(result.verification_version).toBe(1);expect(result.crop.width).toBeLessThan(128);
  const png=await readFile(join(root,'avatar-previews',`${id}.png`));expect(png.subarray(1,4).toString()).toBe('PNG');
  expect(await verifyAvatarMedia(root,id,user,'Bearer test',{supabaseUrl:'https://project.supabase.co',publicKey:'public'})).toEqual(result);
  expect(publicResource).toHaveBeenCalledTimes(1);
 }finally{vi.restoreAllMocks();await rm(root,{recursive:true,force:true});}
},20000);
