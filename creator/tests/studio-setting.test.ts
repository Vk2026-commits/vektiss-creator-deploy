import {afterEach,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readStudio,saveStudio} from '../server/studio-setting';
import {fullCompositionInput} from '../src/lib/full-composition-input';
import {newVideoPlan} from '../src/domain/video-plan';
import {testPayload} from '../supabase/functions/_shared/presenter-test';
import {speechIdentity} from '../src/domain/video-versions';
import {emptyBrief} from '../src/domain/script-brief';
const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
const id='11111111-1111-4111-8111-111111111111';
const background={id,title:'Studio',source_url:''};
it('saves a private owned image, rejects stale updates and cross-account images',async()=>{
 const a=await mkdtemp(join(tmpdir(),'studio-test-')),b=await mkdtemp(join(tmpdir(),'studio-test-'));roots.push(a,b);
 await mkdir(join(a,'.local-captures'));await writeFile(join(a,'.local-captures',`${id}.png`),'fixture');
 expect(await readStudio(a)).toEqual({version:0,background:null});
 expect(await saveStudio(a,{baseVersion:0,background})).toEqual({version:1,background});
 expect(await readStudio(a)).toEqual({version:1,background});
 await expect(saveStudio(a,{baseVersion:0,background})).rejects.toThrow('changed');
 await expect(saveStudio(b,{baseVersion:0,background})).rejects.toThrow();
 expect(await readStudio(b)).toEqual({version:0,background:null});
});
it('research source is not rendered in original or studio modes',async()=>{
 const plan={...newVideoPlan(),video_background:{id:'source',source_url:'https://example.com'},setting:'original' as const};
 const original=await fullCompositionInput({jobId:id,scriptId:id,plan,sourceKind:'video'});
 expect(original).toMatchObject({original_setting:true});expect(original).not.toHaveProperty('video_id');
 const studio=await fullCompositionInput({jobId:id,scriptId:id,plan:{...plan,setting:'studio',studio_background:background},sourceKind:'video'});
 expect(studio).toMatchObject({capture_id:id});expect(studio).not.toHaveProperty('video_id');
 await expect(fullCompositionInput({jobId:id,scriptId:id,plan:{...plan,setting:'studio'},sourceKind:'article'})).rejects.toThrow('studio');
});
it('original setting explicitly requests MP4 without removal and leaves legacy output unchanged',()=>{
 const snapshot={avatar_id:id,voice_id:id,script:'Hello',aspect_ratio:'9:16'};
 expect(testPayload({...snapshot,background_mode:'original'})).toMatchObject({output_format:'mp4',remove_background:false});
 expect(testPayload(snapshot)).toMatchObject({output_format:'webm'});
});
it('graphics and studio changes reuse speech, but setting-mode changes do not',()=>{
 const script={title:'Test',content_profile_id:id,hook:'Hi',body:'Body',cta:'End',brief:{...emptyBrief(),production:{...newVideoPlan(),setting:'studio' as const}}};
 const changed=structuredClone(script);Object.assign(changed.brief.production,{studio_background:background,edit_template:'tier-list'});
 expect(speechIdentity(changed)).toBe(speechIdentity(script));
 Object.assign(changed.brief.production,{setting:'original'});expect(speechIdentity(changed)).not.toBe(speechIdentity(script));
});
