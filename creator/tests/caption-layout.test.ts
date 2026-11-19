import {expect,it} from 'vitest';
import {chromium} from 'playwright-core';
import {defaultEditBrand,editBrandSchema} from '../src/domain/edit-brand';
import {resolveEditStyle} from '../src/domain/edit-style';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {applyCaptionLayout} from '../src/domain/caption-layout';
it('preserves defaults and saved overrides with bounded numeric inputs',()=>{
 expect(applyCaptionLayout('<body></body>',defaultEditBrand)).toBe('<body></body>');
 const settings={captionScale:1.25,captionOffsetY:-12};
 expect(resolveEditStyle({}, {},settings).brand).toMatchObject(settings);
 expect(editBrandSchema.parse(JSON.parse(JSON.stringify({...defaultEditBrand,...settings})))).toMatchObject(settings);
 expect(()=>editBrandSchema.parse({...defaultEditBrand,captionScale:20})).toThrow();
 expect(()=>editBrandSchema.parse({...defaultEditBrand,captionOffsetY:-100})).toThrow();
});
it.skipIf(!process.env.CREATOR_CHROMIUM_PATH)('scales and moves actual captions without drifting on seeks in both formats',async()=>{
 const browser=await chromium.launch({executablePath:process.env.CREATOR_CHROMIUM_PATH,headless:true});
 try{for(const aspectRatio of ['9:16','16:9'] as const)for(const template of ['tier-list','clean-tech','popout-explainer'] as const){
  const page=await browser.newPage({viewport:{width:aspectRatio==='9:16'?1080:1920,height:aspectRatio==='9:16'?1920:1080}});
  const plan={...templateSample(template),aspectRatio};
  const measure=()=>page.evaluate(()=>{(window as any).__timelines.vektiss.seek(2);const c=document.querySelector<HTMLElement>('#captions')!,r=c.getBoundingClientRect();return {font:parseFloat(getComputedStyle(c).fontSize),top:r.top,bottom:r.bottom,text:c.textContent};});
  await page.setContent(hyperframesProject(templateSampleSource,plan,defaultEditBrand,true));const base=await measure();
  await page.goto('about:blank');await page.setContent(hyperframesProject(templateSampleSource,plan,{...defaultEditBrand,captionScale:1.25,captionOffsetY:-10},true));const changed=await measure();
  expect(changed.font).toBeCloseTo(base.font*1.25);expect(changed.top).toBeLessThan(base.top);expect(changed.text).toBe(base.text);expect(await measure()).toEqual(changed);
  await page.goto('about:blank');await page.setContent(hyperframesProject(templateSampleSource,plan,{...defaultEditBrand,captionScale:1.5,captionOffsetY:30},true));const low=await measure();expect(low.bottom).toBeLessThanOrEqual((aspectRatio==='9:16'?1920:1080)*.96+1);
  await page.close();
 }}finally{await browser.close();}
},30000);
