import {expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {mediaBinary} from '../server/media-binaries';
import {fullComposition} from '../server/full-composition';
import {publicResource} from '../server/public-network';
vi.mock('../server/public-network',()=>({publicResource:vi.fn()}));
it('exports original-setting video with audio and reopens the durable file without another download',async()=>{
 const root=await mkdtemp(join(tmpdir(),'original-setting-'));
 try{
  const source=join(root,'fixture.mp4'),id='11111111-1111-4111-8111-111111111111';
  execFileSync(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i','color=c=0x384756:s=180x320:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
  vi.mocked(publicResource).mockResolvedValue({status:200,body:await readFile(source)} as Awaited<ReturnType<typeof publicResource>>);
  vi.spyOn(globalThis,'fetch').mockImplementation(async()=>Response.json({script_id:id,user_id:id,status:'completed',snapshot:{scope:'full',background_mode:'original'},video_url:'https://video.heygen.ai/test.mp4'}));
  const input={original_setting:true,script_id:id,job_id:id,size:65,position:'bottom-right',format:'portrait'};
  const result=await fullComposition(root,input,'Bearer fixture',{VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public'});
  const path=join(root,'edit/compositions',`${result.id}.mp4`);
  const probe=JSON.parse(execFileSync(mediaBinary('ffprobe'),['-v','error','-show_streams','-of','json',path],{encoding:'utf8'}));
  expect(probe.streams.some((s:{codec_type:string})=>s.codec_type==='audio')).toBe(true);
  expect(probe.streams.find((s:{codec_type:string})=>s.codec_type==='video')).toMatchObject({width:720,height:1280});
  expect(await fullComposition(root,input,'Bearer fixture',{VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public'})).toEqual(result);
  expect(publicResource).toHaveBeenCalledTimes(1);
 }finally{vi.restoreAllMocks();await rm(root,{recursive:true,force:true});}
},30000);
