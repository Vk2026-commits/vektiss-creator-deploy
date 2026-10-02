export function publicArticleUrl(value:string):string {
 const url=new URL(value);
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|invalid)$/.test(host))throw Error('SOURCE_URL');
 url.hash='';return url.href;
}
export async function readArticle(value:string, request:typeof fetch=fetch):Promise<string> {
 const url=publicArticleUrl(value);
 // Only this fixed, public reader service receives network requests. Never fetch
 // user-selected hosts from the Supabase runtime or forward cookies/credentials.
 const response=await request(`https://r.jina.ai/${url}`,{headers:{Accept:'text/plain','X-Timeout':'20','DNT':'1'},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('SOURCE_UNAVAILABLE');
 const reader=response.body?.getReader();if(!reader)throw Error('SOURCE_UNAVAILABLE');
 const chunks:Uint8Array[]=[];let bytes=0;
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>200000){await reader.cancel();throw Error('SOURCE_TOO_LONG');}chunks.push(value);}
 const text=await new Blob(chunks as BlobPart[]).text();
 if(text.trim().length<200||text.length>40000)throw Error(text.length>40000?'SOURCE_TOO_LONG':'SOURCE_UNAVAILABLE');
 if(/Warning: Target URL returned error|just a moment\.\.\.|verify you are human|access denied|enable javascript and cookies/i.test(text))throw Error('SOURCE_UNAVAILABLE');
 return text;
}
