import {it,expect} from 'vitest';
import {chromium} from 'playwright-core';
import {animationTemplate,templateAnimation} from '../src/domain/template-animation';
import {hyperframesProject} from '../src/domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
it.skipIf(!process.env.CREATOR_CHROMIUM_PATH)('renders every supported variation with deterministic word-timed motion and no script errors',async()=>{
 const browser=await chromium.launch({executablePath:process.env.CREATOR_CHROMIUM_PATH,headless:true});
 try{
  for(const template of animationTemplate.options)for(const aspectRatio of ['9:16','16:9'] as const){
   const page=await browser.newPage({viewport:{width:aspectRatio==='9:16'?1080:1920,height:aspectRatio==='9:16'?1920:1080},deviceScaleFactor:.3});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.abort());
   const plan={...templateSample(template),aspectRatio,animation:templateAnimation.parse({entrance:'slide',duration:.8,distance:50})};
   await page.setContent(hyperframesProject(templateSampleSource,plan,defaultEditBrand,true));
   const state=async(time:number)=>page.evaluate(t=>{(window as any).__timelines.vektiss.seek(t);return [...document.querySelectorAll<HTMLElement>('[data-reveal]')].map(n=>({anchor:Number(n.dataset.reveal),opacity:n.style.opacity,transform:n.style.transform,svg:n.getAttribute('transform')}));},time);
   const early=await state(.1);expect(early.filter(n=>n.anchor>.1).every(n=>Number(n.opacity)===0)).toBe(true);
   const first=await state(1.2);await state(4);expect(await state(1.2)).toEqual(first);expect(errors,template+' '+aspectRatio).toEqual([]);
   await state(4.1);await page.screenshot({path:`/tmp/workshop-${template}-${aspectRatio.replace(':','-')}.png`});
   await page.close();
  }
 }finally{await browser.close();}
},60000);
