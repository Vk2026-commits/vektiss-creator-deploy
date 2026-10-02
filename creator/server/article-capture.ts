import {chromium} from 'playwright-core';
import {captureUrl,publicResource} from './public-network';

export async function captureArticle(value:string){
 const url=captureUrl(value).href;
 const browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true,timeout:15000});
 const deadline=AbortSignal.timeout(45000);
 const close=()=>{void browser.close();};deadline.addEventListener('abort',close,{once:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block',acceptDownloads:false});
  await context.routeWebSocket('**/*',socket=>socket.close());
  let count=0;
  await context.route('**/*',async route=>{
   try{
    const req=route.request();
    if(++count>180||req.method()!=='GET'||['media','websocket'].includes(req.resourceType()))return await route.abort();
    const response=await publicResource(req.url(),deadline);
    await route.fulfill(response);
   }catch{await route.abort().catch(()=>{});}
  });
  const page=await context.newPage();
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  if(!response?.ok())throw Error('The article could not be opened. Try a public article or upload a screenshot.');
  const body=await page.locator('body').innerText({timeout:5000});
  if(/verify you are human|checking your browser|access denied|subscribe to continue|sign in to continue/i.test(body))throw Error('This page requires access or verification. Open it yourself and upload a screenshot.');
  let heading=page.locator('article h1:visible').first();
  if(!await heading.count())heading=page.locator('main h1:visible').first();
  if(!await heading.count())heading=page.locator('h1:visible').first();
  await heading.waitFor({state:'visible',timeout:8000}).catch(()=>{throw Error('No visible article headline found. Please upload a screenshot instead.');});
  const title=(await heading.innerText()).trim();
  if(title.length<5)throw Error('Could not identify the headline. Please upload a screenshot.');
  await page.evaluate(async()=>{await document.fonts.ready;});
  // Hide only identifiable advertising/consent chrome, not article text or access gates.
  await page.addStyleTag({content:`#onetrust-banner-sdk, #onetrust-consent-sdk, .qc-cmp2-container, [id^="google_ads_iframe"], [id^="div-gpt-ad"], [data-ad-slot], .ad-container, .advertisement { display:none !important; }`});
  await heading.evaluate(el=>{const r=el.getBoundingClientRect();window.scrollTo(0,window.scrollY+r.top-100);});
  const box=await heading.boundingBox();
  if(!box||box.y<0||box.y+box.height>844||box.x<0||box.x+box.width>391)throw Error('The whole headline does not fit. Upload a mobile screenshot with the full title.');
  const png=await page.screenshot({type:'png',fullPage:false,animations:'disabled',timeout:8000});
  return {png,title,source_url:url};
 }finally{deadline.removeEventListener('abort',close);await browser.close();}
}
