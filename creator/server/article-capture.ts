import {chromium} from 'playwright-core';
import {captureUrl,publicResource} from './public-network';

export async function captureArticle(value:string){
 const url=captureUrl(value).href;
 const browser=await chromium.launch({...process.env.CREATOR_CHROMIUM_PATH?{executablePath:process.env.CREATOR_CHROMIUM_PATH}:{channel:'chrome'},headless:true,chromiumSandbox:true,timeout:15000});
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
  const article=page.locator('article').first();
  const excerpt=await article.count()?await article.innerText({timeout:3000}):body;
  return {png,title,source_url:url,caption:excerpt.trim().slice(0,2000)};
 }finally{deadline.removeEventListener('abort',close);await browser.close();}
}

export function articleCardText(value:string){
 const url=captureUrl(value);
 const slug=decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)??'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
 const title=(slug||'Article').replace(/(^|\s)\S/g,letter=>letter.toUpperCase()).slice(0,240);
 return {title,host:url.hostname.replace(/^www\./,'')};
}

// Some publishers return a rate-limit page to datacenter IPs even though the
// same article is public in a reader's browser. In that case, create a clean
// source card from the canonical URL instead of forcing the creator to take a
// screenshot. This is deliberately visual-only: it does not invent article
// facts or treat the creator's direction as source evidence.
export async function captureArticleCard(value:string){
 const url=captureUrl(value).href,{title,host}=articleCardText(url);
 const browser=await chromium.launch({...process.env.CREATOR_CHROMIUM_PATH?{executablePath:process.env.CREATOR_CHROMIUM_PATH}:{channel:'chrome'},headless:true,chromiumSandbox:true,timeout:15000});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
   *{box-sizing:border-box}body{margin:0;width:1080px;height:1920px;background:linear-gradient(155deg,#f7fbff 0%,#e7f1ff 56%,#dbe9fb 100%);font-family:Arial,sans-serif;color:#0b1727;display:flex;align-items:center;justify-content:center;padding:96px}.card{width:100%;background:#fff;border:2px solid #cbd9ea;border-radius:44px;padding:82px 72px;box-shadow:0 28px 80px #102b5224}.eyebrow{font-size:32px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#087df0;margin-bottom:42px}.title{font-size:66px;line-height:1.08;font-weight:850;letter-spacing:-.035em;overflow-wrap:anywhere}.rule{width:120px;height:10px;border-radius:10px;background:#087df0;margin:58px 0 34px}.host{font-size:34px;color:#52667e}.note{font-size:27px;line-height:1.45;color:#647790;margin-top:70px}</style></head><body><main class="card"><div class="eyebrow">Article</div><div class="title"></div><div class="rule"></div><div class="host"></div><div class="note">Open the source to read the original article.</div></main></body></html>`,{waitUntil:'domcontentloaded'});
  await page.locator('.title').evaluate((el,text)=>{el.textContent=text;},title);
  await page.locator('.host').evaluate((el,text)=>{el.textContent=text;},host);
  const png=await page.screenshot({type:'png',fullPage:false,animations:'disabled',timeout:8000});
  return {png,title,source_url:url};
 }finally{await browser.close();}
}
