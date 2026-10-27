import {alphaSample} from '../domain/alpha-sample';
import {useEffect,useMemo,useRef,useState} from 'react';
import {hyperframesProject} from '../domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../domain/edit-template-samples';
import {editDimensions,type EditAspectRatio} from '../domain/edit-format';
import type {EditBrand} from '../domain/edit-brand';
import type {RenderLogo} from '../domain/logo-assets';
import type {EditProposal} from '../domain/edit-templates';
export function HyperframesSample({brand,frame,aspectRatio,mediaUrl,templateId='hyperframes-motion'}:{brand:EditBrand;frame:number;aspectRatio:EditAspectRatio;mediaUrl?:string|null;templateId?:EditProposal['templateId']}){
 // Segmentation is prepared at export; gallery uses the ready-made aligned sample.
 if(templateId==='popout-explainer'||templateId==='paper-cutout')mediaUrl=null;
 const suppliedMedia=mediaUrl;
 if(!mediaUrl)mediaUrl=templateId==='paper-cutout'?null:'/style-assets/glass-presenter.mp4';
 const [sampleLogos,setSampleLogos]=useState<RenderLogo[]>([]);
 useEffect(()=>{if(templateId!=='clean-tech')return;let live=true;void Promise.all(['chatgpt','claude'].map(async(id,i)=>{const r=await fetch('/style-assets/'+id+'.png');if(!r.ok)throw Error();const blob=await r.blob();const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});return {name:i?'Claude':'ChatGPT',firstWord:i*2,image};})).then(logos=>{if(live)setSampleLogos(logos);}).catch(()=>{});return()=>{live=false;};},[templateId]);
 const ref=useRef<HTMLIFrameElement>(null);
 const matteMedia=useRef<Blob|null>(null);
 useEffect(()=>{matteMedia.current=null;if(!['popout-explainer','paper-cutout'].includes(templateId))return;const abort=new AbortController();fetch('/style-assets/'+(templateId==='paper-cutout'?'paper':'popout')+'-presenter-sprite.webp',{signal:abort.signal}).then(r=>r.blob()).then(blob=>{if(abort.signal.aborted)return;matteMedia.current=blob;ref.current?.contentWindow?.postMessage({type:'vektiss-local-matte',blob},'*');}).catch(()=>{});return()=>abort.abort();},[templateId,suppliedMedia]);
 const localMedia=useRef<Blob|null>(null);
 useEffect(()=>{localMedia.current=null;if(!mediaUrl)return;const abort=new AbortController();fetch(mediaUrl,{signal:abort.signal}).then(r=>r.blob()).then(blob=>{if(abort.signal.aborted)return;localMedia.current=blob;ref.current?.contentWindow?.postMessage({type:'vektiss-local-media',blob},'*');}).catch(()=>{});return()=>abort.abort();},[mediaUrl,templateId]);
 const html=useMemo(()=>{const previewSource=templateId==='charts-comparisons'?{...templateSampleSource,words:'Example data before 12 hours after 3 hours saved time'.split(' ').map((text,i)=>({text,start:i*.5,end:(i+1)*.5}))}:templateSampleSource;
  const previewPlan={...templateSample(templateId),aspectRatio};
  if(templateId==='charts-comparisons'){previewPlan.beats[0].headline='Time spent';previewPlan.beats[0].graphics!.chart={unit:'hours',items:[{label:'Before',value:12,sourceWord:3},{label:'After',value:3,sourceWord:6}]};}
  let sample=hyperframesProject(previewSource,previewPlan,!suppliedMedia?{...brand,captionStyle:'none'}:brand,true,sampleLogos);
  if(templateId==='paper-cutout'&&suppliedMedia)return sample;
  if(templateId==='phone-mockup')sample=sample.replace('<div class="sample">SAMPLE<br>PRESENTER</div>','<video muted playsinline></video>');
  sample=sample.replace("media-src 'self';","media-src 'self' blob:;").replace('</head>',`<style>#sample-label{display:none}video{background:transparent!important;${templateId==='popout-explainer'?'':'clip-path:none!important;'}}</style></head>`);
  if(['popout-explainer','paper-cutout'].includes(templateId))sample=alphaSample(sample,templateId==='paper-cutout');
  const sync=(parameter:string)=>`window.sampleTime=${parameter};for(const sampleVideo of document.querySelectorAll('video')){if(sampleVideo?.readyState>=1&&Number.isFinite(${parameter})&&Math.abs(sampleVideo.currentTime-${parameter})>.03)sampleVideo.currentTime=Math.max(0,Math.min(${parameter},sampleVideo.duration-.04));}`;
  return sample.replace('function seek(t){','function seek(t){'+sync('t')).replace('function seek(raw){','function seek(raw){'+sync('raw')).replace('</script>',`window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='vektiss-local-media'||!(event.data.blob instanceof Blob))return;const media=document.querySelector(event.data.type==='vektiss-local-matte'?'#cutout':'video');if(!media)return;if(media.dataset.blobUrl)URL.revokeObjectURL(media.dataset.blobUrl);media.dataset.blobUrl=URL.createObjectURL(event.data.blob);media.muted=true;media.playsInline=true;media.src=media.dataset.blobUrl;media.onloadedmetadata=()=>seek(window.sampleTime??1.5);});</script>`);
 },[brand,aspectRatio,mediaUrl,suppliedMedia,templateId,sampleLogos]);
 const seek=()=>ref.current?.contentWindow?.postMessage({type:'vektiss-seek',time:frame/30},'*');
 const loaded=()=>{seek();if(matteMedia.current)ref.current?.contentWindow?.postMessage({type:'vektiss-local-matte',blob:matteMedia.current},'*');if(localMedia.current)ref.current?.contentWindow?.postMessage({type:'vektiss-local-media',blob:localMedia.current},'*');};
 useEffect(seek,[frame,html]);
 return <div style={{...editDimensions(aspectRatio),position:'relative'}}><iframe ref={ref} title={`${templateId} animated sample`} sandbox="allow-scripts" srcDoc={html} onLoad={loaded} style={{...editDimensions(aspectRatio),position:'absolute',inset:0,border:0,pointerEvents:'none'}}/></div>;
}
