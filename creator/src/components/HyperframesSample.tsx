import {useEffect,useMemo,useRef,useState} from 'react';
import {hyperframesProject} from '../domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../domain/edit-template-samples';
import {editDimensions,type EditAspectRatio} from '../domain/edit-format';
import type {EditBrand} from '../domain/edit-brand';
import {StyleSampleFootage} from './StyleSampleFootage';
import type {RenderLogo} from '../domain/logo-assets';
import type {EditProposal} from '../domain/edit-templates';
export function HyperframesSample({brand,frame,aspectRatio,mediaUrl,templateId='hyperframes-motion'}:{brand:EditBrand;frame:number;aspectRatio:EditAspectRatio;mediaUrl?:string|null;templateId?:EditProposal['templateId']}){
 const suppliedMedia=mediaUrl;
 if(['glass-cards','animated-explainer','charts-comparisons'].includes(templateId)&&!mediaUrl)mediaUrl='/style-assets/glass-presenter.mp4';
 const [sampleLogos,setSampleLogos]=useState<RenderLogo[]>([]);
 useEffect(()=>{if(templateId!=='clean-tech')return;let live=true;void Promise.all(['chatgpt','claude'].map(async(id,i)=>{const r=await fetch('/style-assets/'+id+'.png');if(!r.ok)throw Error();const blob=await r.blob();const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});return {name:i?'Claude':'ChatGPT',firstWord:i*2,image};})).then(logos=>{if(live)setSampleLogos(logos);}).catch(()=>{});return()=>{live=false;};},[templateId]);
 const ref=useRef<HTMLIFrameElement>(null);
 const localMedia=useRef<Blob|null>(null);
 useEffect(()=>{localMedia.current=null;if(!['phone-mockup','clean-tech','glass-cards','animated-explainer','charts-comparisons'].includes(templateId)||!mediaUrl)return;const abort=new AbortController();fetch(mediaUrl,{signal:abort.signal}).then(r=>r.blob()).then(blob=>{if(abort.signal.aborted)return;localMedia.current=blob;ref.current?.contentWindow?.postMessage({type:'vektiss-local-media',blob},'*');}).catch(()=>{});return()=>abort.abort();},[mediaUrl,templateId]);
 const html=useMemo(()=>{const previewSource=templateId==='charts-comparisons'?{...templateSampleSource,words:'Example data before 12 hours after 3 hours saved time'.split(' ').map((text,i)=>({text,start:i*.5,end:(i+1)*.5}))}:templateSampleSource;
  const previewPlan={...templateSample(templateId),aspectRatio};
  if(templateId==='charts-comparisons'){previewPlan.beats[0].headline='Time spent';previewPlan.beats[0].graphics!.chart={unit:'hours',items:[{label:'Before',value:12,sourceWord:3},{label:'After',value:3,sourceWord:6}]};}
  const sample=hyperframesProject(previewSource,previewPlan,['glass-cards','animated-explainer','charts-comparisons'].includes(templateId)&&!suppliedMedia?{...brand,captionStyle:'none'}:brand,true,sampleLogos);
  if(['clean-tech','glass-cards','animated-explainer','charts-comparisons'].includes(templateId)&&mediaUrl&&(mediaUrl.startsWith('blob:')||['glass-cards','animated-explainer','charts-comparisons'].includes(templateId)))return sample.replace('function seek(t){','function seek(t){window.sampleTime=t;if(video.readyState>=1&&Math.abs(video.currentTime-t)>.03)video.currentTime=Math.min(t,video.duration-.04);').replace('</script>',`window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='vektiss-local-media'||!(event.data.blob instanceof Blob))return;if(window.localUrl)URL.revokeObjectURL(window.localUrl);window.localUrl=URL.createObjectURL(event.data.blob);video.muted=true;video.src=window.localUrl;video.onloadedmetadata=()=>seek(window.sampleTime??1.5);});</script>`);
  if(templateId==='phone-mockup' &&mediaUrl?.startsWith('blob:'))return sample.replace("media-src 'self'","media-src 'self' blob:").replace('<div class="sample">SAMPLE<br>PRESENTER</div>','<video muted playsinline></video>').replace('function seek(raw){','function seek(raw){window.sampleTime=raw;const media=document.querySelector("video");if(media?.readyState>=1&&Number.isFinite(raw)&&Math.abs(media.currentTime-raw)>.03)media.currentTime=Math.min(raw,media.duration-.04);').replace('</script>',`window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='vektiss-local-media'||!(event.data.blob instanceof Blob))return;const media=document.querySelector('video');if(window.localUrl)URL.revokeObjectURL(window.localUrl);window.localUrl=URL.createObjectURL(event.data.blob);media.src=window.localUrl;media.onloadedmetadata=()=>seek(window.sampleTime??1.5);});</script>`);
  return mediaUrl&&templateId==='hyperframes-motion'?sample.replace('</head>','<style>html,body,#stage{background:transparent!important}video,#sample-label{visibility:hidden}</style></head>'):sample;
 },[brand,aspectRatio,mediaUrl,suppliedMedia,templateId,sampleLogos]);
 const seek=()=>ref.current?.contentWindow?.postMessage({type:'vektiss-seek',time:frame/30},'*');
 const loaded=()=>{seek();if(localMedia.current)ref.current?.contentWindow?.postMessage({type:'vektiss-local-media',blob:localMedia.current},'*');};
 useEffect(seek,[frame,html]);
 return <div style={{...editDimensions(aspectRatio),position:'relative'}}>{mediaUrl&&templateId==='hyperframes-motion'&&<StyleSampleFootage url={mediaUrl} frame={frame}/>}<iframe ref={ref} title={`${templateId} animated sample`} sandbox="allow-scripts" srcDoc={html} onLoad={loaded} style={{...editDimensions(aspectRatio),position:'absolute',inset:0,border:0,pointerEvents:'none'}}/></div>;
}
