import {afterEach,expect,it,vi} from 'vitest';
import {templateEdit,templateEditOptions,saveTemplatePlan,readTemplatePlan} from '../server/template-edit';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
afterEach(()=>vi.unstubAllGlobals());
const profileId='00000000-0000-4000-8000-000000000001';
it('denies another profile before reading media or starting paid processing',async()=>{
 const request=vi.fn().mockResolvedValue(new Response('[]',{status:200}));vi.stubGlobal('fetch',request);
 await expect(templateEdit('/nonexistent','/nonexistent.mp4','video/mp4',{profileId,template:'recommend'},'Bearer test',{supabaseUrl:'https://example.invalid',publicKey:'public'})).rejects.toThrow('Select one of your Content Profiles');
 expect(request).toHaveBeenCalledTimes(1);
 expect(request.mock.calls[0][0]).toContain('/rest/v1/content_profiles');
});
it('rejects caller paths, remote sources, and unregistered styles',()=>{
 for(const extra of [{exportId:'../../private'},{url:'https://example.com/source.mp4'},{template:'custom-code'}])expect(()=>templateEditOptions.parse({profileId,template:'recommend',...extra})).toThrow();
});
it('saves a validated scene edit without paid calls and rejects stale or speech-changing edits',async()=>{
 const root=await mkdtemp(join(tmpdir(),'template-edit-test-'));
 try{
  const folder=join(root,'edit/template-plans');await mkdir(folder,{recursive:true});
  const id='a'.repeat(64),revision='b'.repeat(64);
  const source={assetId:profileId,revision,kind:'upload',duration:2,words:[{start:0,end:1,text:'Value'}]};
  const proposal={version:1,templateId:'premium-explainer',sourceRevision:revision,beats:[{firstWord:0,lastWord:0,layout:'presenter',visual:'diagram',headline:'Value',purpose:'Explain value',illustration:'Problem to solution',motion:'Reveal'}]};
  await writeFile(join(folder,`${revision}.source.json`),JSON.stringify(source));
  await writeFile(join(folder,`${id}.json`),JSON.stringify({id,version:1,proposal}));
  const request=vi.fn();vi.stubGlobal('fetch',request);
  const result=await saveTemplatePlan(root,{id,baseVersion:1,proposal:{...proposal,beats:[{...proposal.beats[0],illustration:'Show a customer receiving a useful solution'}]}});
  expect(result.version).toBe(2);expect(result.storyboard[0].spokenText).toBe('Value');
  expect((await readTemplatePlan(root,id)).proposal.beats[0].illustration).toContain('customer');
  await expect(saveTemplatePlan(root,{id,baseVersion:1,proposal})).rejects.toThrow('This plan changed');
  await expect(saveTemplatePlan(root,{id,baseVersion:2,proposal:{...proposal,sourceRevision:'c'.repeat(64)}})).rejects.toThrow('EDIT_SOURCE_CHANGED');
  expect(request).not.toHaveBeenCalled();
 }finally{await rm(root,{recursive:true,force:true});}
});
