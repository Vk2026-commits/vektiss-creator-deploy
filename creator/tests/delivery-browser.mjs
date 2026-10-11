import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let analyses=0;
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Microphone access denied','NotAllowedError');};});
  await page.route('https://delivery-test.invalid/**',async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
   if(route.request().url().includes('/functions/v1/delivery-analysis')){analyses++;assert.equal(route.request().headers()['x-analysis-consent'],'true');return route.fulfill({json:{suggestions:{pace:'Conversational pace',energy:'Measured emphasis',pauses:'Pause between ideas',emphasis:'Stress the key action',phrasing:'Short direct sentences',closing:'Settle on the last word',uncertainty:'Synthetic fixture, not a voice assessment'}}});}
   return route.fulfill({json:[]});
  });
  await page.goto('http://127.0.0.1:5186/tests/fixtures/delivery.html');
  await page.getByRole('heading',{name:'Show us how you speak'}).waitFor();
  await page.getByRole('button',{name:'Record up to 60 seconds'}).click();
  await page.getByRole('alert').filter({hasText:'Microphone access denied'}).waitFor();
  await page.getByRole('button',{name:'Skip reference setup'}).click();
  await page.getByRole('button',{name:'Save creator profile',exact:true}).click();
  assert.equal(JSON.parse(await page.getByLabel('Saved profile').textContent()).context.delivery_setup,'skipped');
  const bytes=await page.evaluate(async()=>{const {pcmWav}=await import('/src/lib/delivery-audio.ts');const samples=new Float32Array(16000*12);for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i/10)*.2;return Array.from(new Uint8Array(await pcmWav(samples).arrayBuffer()));});
  await page.locator('input[type=file]').setInputFiles({name:'reference.wav',mimeType:'audio/wav',buffer:Buffer.from(bytes)});
  assert.equal(await page.getByRole('button',{name:'Analyze this recording'}).isDisabled(),true);
  await page.getByRole('checkbox',{name:/This is my voice/}).check();
  await page.getByRole('button',{name:'Analyze this recording'}).click();
  await page.getByLabel('Pace',{exact:true}).waitFor({timeout:10000}).catch(async e=>{console.log({analyses,errors,body:await page.locator('body').innerText()});throw e;});
  assert.equal(analyses,1);assert.equal(await page.locator('audio').count(),0);
  assert.equal(JSON.parse(await page.getByLabel('Saved profile').textContent()).context.delivery,undefined);
  await page.getByLabel('Pace',{exact:true}).fill('Warm and conversational');
  await page.getByRole('button',{name:'Approve preferences',exact:true}).click();
  await page.getByRole('button',{name:'Save creator profile',exact:true}).click();
  const saved=JSON.parse(await page.getByLabel('Saved profile').textContent());assert.equal(saved.context.delivery.pace,'Warm and conversational');
  assert.equal(saved.context.delivery.version,1);assert.ok(!('transcript' in saved.context.delivery));
  assert.deepEqual(errors,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  await page.screenshot({path:`/private/tmp/delivery-${width}.png`,fullPage:true});
  console.log(`PASS: ${width}px upload, consent, analysis, discard, edit, approval and profile save`);
  await page.close();
 }
}finally{await browser.close();}
