import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {storyBackground} from '../server/story-background';
import {mediaBinary} from '../server/media-binaries';
import {screenshotStorySchema,storySectionsFromStarts} from '../src/domain/screenshot-story';
import {openAICost} from '../src/domain/project-cost';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const story=screenshotStorySchema.parse({version:1,images:ids.map(id=>({id,title:'Screenshot',source_url:''})),sections:[{image_id:ids[0],text:'First image now.'},{image_id:ids[1],text:'Second image now.'}]});
it('maps exact narration without allowing changes or out-of-order sections',()=>{
 expect(storySectionsFromStarts(story,'First image now. Second image now.',[0,3]).sections).toEqual(story.sections);
 for(const starts of [[1,3],[0,0],[0,6],[],[0]])expect(()=>storySectionsFromStarts(story,'First image now. Second image now.',starts)).toThrow();
 expect(openAICost('whisper-1',{duration_seconds:60})).toBe(.006);
});
it('renders fitted screenshots at spoken transitions and holds the last image',async()=>{
 const root=await mkdtemp(join(tmpdir(),'creator-story-test-')),folder=join(root,'edit');const exec=promisify(execFile);
 try{
  await mkdir(join(root,'.local-captures'));await mkdir(folder);
  for(const [i,color] of ['red','blue'].entries())await exec(mediaBinary('ffmpeg'),['-v','error','-f','lavfi','-i',`color=c=${color}:s=160x240`,'-frames:v','1',join(root,'.local-captures',`${ids[i]}.png`)]);
  const words='First image now Second image now'.split(' ').map((word,i)=>({word,start:i<3?i*.2:1.6+(i-3)*.2,end:i<3?i*.2+.15:1.6+(i-3)*.2+.15}));
  await writeFile(join(folder,'fixture.story-words-v1.json'),JSON.stringify(words));
  const args={root,folder,id:'fixture',jobId:'fixture',source:'unused',story,duration:3,w:160,h:240,profileId:ids[0],projectId:ids[0],authorization:'',env:{}};
  const result=await storyBackground(args);expect(result.timing[0].end).toBe(1.6);expect(result.timing[1].end).toBe(3);
  const probe=JSON.parse((await exec(mediaBinary('ffprobe'),['-v','error','-show_format','-of','json',result.path])).stdout);expect(Number(probe.format.duration)).toBeCloseTo(3,1);
  for(const [time,channel] of [['0.8',0],['2.7',2]] as const){const frame=await exec(mediaBinary('ffmpeg'),['-v','error','-ss',time,'-i',result.path,'-frames:v','1','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:'buffer'});expect(frame.stdout[channel]).toBeGreaterThan(200);}
  await expect(storyBackground({...args,root:join(root,'another-user')})).rejects.toThrow();
 }finally{await rm(root,{recursive:true,force:true});}
},30000);
