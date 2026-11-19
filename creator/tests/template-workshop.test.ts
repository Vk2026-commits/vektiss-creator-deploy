import {describe,it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {animationFrame,defaultTemplateAnimation,templateDesignInput,templateAnimation} from '../src/domain/template-animation';
import {listTemplateDesigns,readTemplateDesign,saveTemplateDesign,publishTemplateDesign,publishedTemplateAnimations,templateDesignPreview} from '../server/template-workshop';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {defaultEditBrand} from '../src/domain/edit-brand';
import {validateEditProposal} from '../src/domain/edit-templates';
const design=templateDesignInput.parse({name:'Readable ranking',template:'tier-list',animation:{entrance:'fade',duration:.8}});
describe('animation workshop',()=>{
 it('rejects code, urls, unbounded animation and unsupported templates',()=>{
  for(const input of [{...design,html:'<script/>'},{...design,template:'paper-cutout'},{...design,animation:{duration:100}},{...design,animation:{entrance:'url(x)'}}])expect(templateDesignInput.safeParse(input).success).toBe(false);
 });
 it('keeps speech anchor exact and supports deterministic reverse seeking',()=>{
  expect(animationFrame(1,2,defaultTemplateAnimation).opacity).toBe(0);
  expect(animationFrame(3,2,defaultTemplateAnimation)).toEqual({opacity:1,x:0,y:0,scale:1});
  expect(animationFrame(2,2,templateAnimation.parse({entrance:'slide'})).x).toBe(32);
  expect(animationFrame(2.2,2,defaultTemplateAnimation)).toEqual(animationFrame(2.2,2,defaultTemplateAnimation));
 });
 it('persists unpublished revisions, rejects conflicts, isolates users and snapshots publishing',async()=>{
  const root=await mkdtemp(join(tmpdir(),'workshop-')),other=await mkdtemp(join(tmpdir(),'other-'));
  try{
   const id=randomUUID(),first=await saveTemplateDesign(root,{id,revision:0,design});
   expect(await saveTemplateDesign(root,{id,revision:0,design})).toEqual(first);
   expect(await publishedTemplateAnimations(root)).toEqual({});
   await expect(readTemplateDesign(other,id)).rejects.toThrow('not found');
   expect(await listTemplateDesigns(other)).toEqual([]);
   await publishTemplateDesign(root,{id,revision:1,reviewedPreview:true,publish:true});
   const revised=await saveTemplateDesign(root,{id,revision:1,design:{...design,animation:{...design.animation,entrance:'slide'}}});
   expect(revised.published?.revision).toBe(1);
   expect((await publishedTemplateAnimations(root))['tier-list'].entrance).toBe('fade');
   await expect(saveTemplateDesign(root,{id,revision:1,design})).rejects.toThrow('changed');
   await expect(publishTemplateDesign(root,{id,revision:1,reviewedPreview:true,publish:true})).rejects.toThrow('changed');
   await expect(publishTemplateDesign(root,{id,revision:2,reviewedPreview:false,publish:true})).rejects.toThrow();
   await expect(templateDesignPreview(root,id,1)).rejects.toThrow('changed');
   const preview=await templateDesignPreview(root,id,2);expect(preview.html).toContain('"entrance":"slide"');
   await publishTemplateDesign(root,{id,revision:2,reviewedPreview:true,publish:true});
   expect((await publishedTemplateAnimations(root))['tier-list'].entrance).toBe('slide');
   await publishTemplateDesign(root,{id,revision:2,reviewedPreview:true,publish:false});expect(await publishedTemplateAnimations(root)).toEqual({});
  }finally{await rm(root,{recursive:true,force:true});await rm(other,{recursive:true,force:true});}
 });
 it('uses the same motion in preview and export without changing content or reveal order',()=>{
  const plan={...templateSample('tier-list'),animation:design.animation};
  const before=JSON.stringify(plan.beats);
  for(const sample of [true,false]){const html=hyperframesProject(templateSampleSource,plan,defaultEditBrand,sample);expect(html).toContain('"entrance":"fade"');expect(html).toContain('Solve a need');expect(html).toContain('data-reveal="0.5"');}
  expect(JSON.stringify(plan.beats)).toBe(before);
  expect(()=>validateEditProposal({...templateSample('walkthrough'),animation:design.animation},templateSampleSource,'walkthrough')).toThrow();
 });
});
