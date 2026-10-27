/** Frame-atlas preview avoids browser-specific transparent-video codec support. */
export function alphaSample(html:string,paper:boolean){
 html=html.replace(/<video\b[^>]*><\/video>/g,(tag)=>paper||tag.includes('id="cutout"')?`<canvas id="${paper?'paper-presenter':'cutout'}" width="270" height="480"></canvas>`:tag);
 html=html.replace(/<style>([\s\S]*?)<\/style>/g,(_,css:string)=>'<style>'+css.replace(/\bvideo\b/g,':is(video,canvas)')+'</style>');
 if(paper)html=html.replaceAll("document.querySelector('video')","document.querySelector('canvas')");
 html=html.replace("img-src 'self' data:","img-src 'self' data: blob:");
 const sync=`window.alphaTime=Number.isFinite(t)?t:0;if(window.alphaSheet){const canvas=document.querySelector('canvas'),n=Math.max(0,Math.min(149,Math.floor(window.alphaTime*30))),ctx=canvas?.getContext('2d');if(ctx){ctx.clearRect(0,0,270,480);ctx.drawImage(window.alphaSheet,(n%10)*270,Math.floor(n/10)*480,270,480,0,0,270,480);}}`;
 html=html.replace('function seek(t){','function seek(t){'+sync).replace('function seek(raw){','function seek(raw){'+sync.replaceAll('Number.isFinite(t)?t:0','Number.isFinite(raw)?raw:0'));
 return html.replace('</script>',`window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='vektiss-local-matte'||!(event.data.blob instanceof Blob))return;const url=URL.createObjectURL(event.data.blob),img=new Image();img.onload=()=>{window.alphaSheet=img;seek(window.alphaTime??1.5);URL.revokeObjectURL(url);};img.src=url;});</script>`);
}
