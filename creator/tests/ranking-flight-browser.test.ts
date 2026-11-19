import {it,expect} from 'vitest';
import {chromium} from 'playwright-core';
import {rankingProject} from '../src/domain/ranking-project';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {defaultEditBrand} from '../src/domain/edit-brand';
it.skipIf(!process.env.CREATOR_CHROMIUM_PATH)('moves the same visible card into its exact slot in both formats and survives seeking',async()=>{
 const browser=await chromium.launch({executablePath:process.env.CREATOR_CHROMIUM_PATH,headless:true});
 try{for(const aspectRatio of ['9:16','16:9'] as const){
  const page=await browser.newPage({viewport:{width:aspectRatio==='9:16'?1080:1920,height:aspectRatio==='9:16'?1920:1080},deviceScaleFactor:.4});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const plan=templateSample('tier-list');plan.aspectRatio=aspectRatio;plan.showRankingTitle=false;
  plan.beats[0].graphics!.nodes[0].introducedWord=0;
  const node=plan.beats[0].graphics!.nodes[0],verdict=templateSampleSource.words[node.revealWord!].start;
  await page.setContent(rankingProject(templateSampleSource,plan,defaultEditBrand,true));
  const at=async(t:number)=>page.evaluate(time=>{(window as any).__timelines.vektiss.seek(time);const card=document.querySelector<HTMLElement>('[data-flight="0"]')!,slot=document.querySelector<HTMLElement>('[data-slot="0"]')!;const a=card.getBoundingClientRect(),b=slot.getBoundingClientRect();return {x:a.x,y:a.y,w:a.width,h:a.height,opacity:card.style.opacity,target:{x:b.x,y:b.y,w:b.width,h:b.height},parent:card.parentElement!.id,slotVisible:getComputedStyle(slot).visibility};},t);
  const popped=await at(.3);expect(popped.opacity).toBe('1');expect(popped.parent).toBe('stage');expect(popped.slotVisible).toBe('hidden');
  await page.screenshot({path:`/tmp/ranking-pop-${aspectRatio.replace(':','-')}.png`});
  const moving=await at(verdict+.425);expect(moving.y).toBeGreaterThan(popped.y);expect(moving.y).toBeLessThan(moving.target.y);
  await page.screenshot({path:`/tmp/ranking-travel-${aspectRatio.replace(':','-')}.png`});
  const landed=await at(verdict+1);for(const k of ['x','y','w','h'] as const)expect(landed[k]).toBeCloseTo(landed.target[k],1);
  expect(await at(.3)).toEqual(popped);expect(errors).toEqual([]);await page.close();
 }}finally{await browser.close();}
});
