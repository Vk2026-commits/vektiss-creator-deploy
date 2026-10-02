import {loadEnv} from 'vite';
// Server-only configuration. Never expose these values through VITE_* variables.
const hostedOrigin = 'https://mc-4rr8dq8lv6.bunny.run';
export async function cobaltVideo(url:string,consume?:(source:AsyncIterable<Uint8Array>)=>Promise<{body:Buffer;type:string}>) {
 const env=loadEnv(process.env.NODE_ENV??'development',process.cwd(),'CREATOR_COBALT_');
 const origin=env.CREATOR_COBALT_URL??'http://127.0.0.1:9000';
 const key=env.CREATOR_COBALT_KEY;
 if(!['http://127.0.0.1:9000',hostedOrigin].includes(origin)||(origin===hostedOrigin&&!key))throw Error('VIDEO_SETUP');
 const signal=AbortSignal.timeout(600000);
 let response:Response;
 try { response=await fetch(origin+'/',{method:'POST',redirect:'error',signal,headers:{Accept:'application/json','Content-Type':'application/json',...(key?{Authorization:`Api-Key ${key}`}:{})},body:JSON.stringify({url,videoQuality:'480',localProcessing:'disabled',alwaysProxy:true})}); }
 catch { throw Error('VIDEO_SETUP'); }
 const result=await response.json();
 if(!response.ok||result.status==='error')throw Error(/login|private|age|sensitive|auth/i.test(result.error?.code??'')?'VIDEO_LOGIN':'VIDEO_EXTRACT');
 if(result.status!=='tunnel'||typeof result.url!=='string')throw Error('VIDEO_FORMAT');
 const tunnel=new URL(result.url);
 if(tunnel.origin!==origin||tunnel.pathname!=='/tunnel'||tunnel.username||tunnel.password)throw Error('VIDEO_EXTRACT');
 const media=await fetch(tunnel,{signal,redirect:'error'});
 const type=media.headers.get('content-type')?.split(';')[0];
 if(!media.ok||!media.body||!['video/mp4','video/webm'].includes(type??''))throw Error('VIDEO_FORMAT');
 if(consume)return consume(media.body as unknown as AsyncIterable<Uint8Array>);
 const reader=media.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10*1024*1024)throw Error('VIDEO_FORMAT');chunks.push(value);} }
 finally { await reader.cancel(); }
 if(!size)throw Error('VIDEO_FORMAT');
 return {body:Buffer.concat(chunks),type:type!};
}
