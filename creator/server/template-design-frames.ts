import {chromium} from 'playwright-core';
import {templateDesignPreview} from './template-workshop';
let active=0;
/** Render trusted local HTML only; never navigate a URL or accept executable content. */
export async function templateDesignFrames(root:string,id:string,revision:number,aspectRatio:'9:16'|'16:9',times:number[]){
 if(active>=2)throw Error('Preview renderer is busy. Retry shortly.');
 const preview=await templateDesignPreview(root,id,revision,aspectRatio);
 if(times.some(t=>!Number.isFinite(t)||t<0||t>=preview.duration)||times.length<1||times.length>4)throw Error('Choose one to four times within the five-second preview.');
 active++;let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CREATOR_CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:15000});
  const width=aspectRatio==='16:9'?1920:1080,height=aspectRatio==='9:16'?1920:1080;
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:.5});
  await page.route('**/*',route=>route.abort());
  await page.setContent(preview.html,{waitUntil:'domcontentloaded',timeout:10000});
  const frames=[];
  for(const time of times){await page.evaluate(t=>(window as any).__timelines.vektiss.seek(t),time);frames.push({time,data:(await page.screenshot({type:'jpeg',quality:75,timeout:10000})).toString('base64')});}
  return {frames,notice:preview.notice};
 }finally{await browser?.close();active--;}
}
