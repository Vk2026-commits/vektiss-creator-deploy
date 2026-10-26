import {editStoryboard, validateEditProposal, type EditSource, type EditProposal} from './edit-templates.ts';
import {editBrandSchema, type EditBrand} from './edit-brand.ts';
import {editDimensions} from './edit-format.ts';

// Local authoring bridge only. Never accept executable HTML or URLs from the model.
export const HYPERFRAMES_VERSION='0.8.206';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function hyperframesProject(source:EditSource,raw:EditProposal,rawBrand:EditBrand,sample=false){
 const plan=validateEditProposal(raw,source,raw.templateId);
 const brand=editBrandSchema.parse(rawBrand);
 const {width,height}=editDimensions(plan.aspectRatio);
 const wide=width>height;
 const scenes=editStoryboard(plan,source).map((b,i)=>{
  const presenter=b.layout==='presenter'||b.visual==='presenter';
  const nodes=(b.graphics?.nodes??[]).map((n,j)=>{
   const start=n.revealWord===undefined?Math.min(b.end-.01,b.start+j*.35):source.words[n.revealWord].start;
   return `<div class="node" data-reveal="${start}">${n.tier?`<strong>${escape(n.tier)}</strong> `:''}${escape(n.label)}</div>`;
  }).join('');
  return `<section data-scene="${escape(b.scene??'network')}" data-from="${b.start}" data-to="${b.end}" data-presenter="${presenter}" data-full="${b.layout==='full-graphic'}"><div class="graphics"><small>${escape(plan.templateId.replaceAll('-',' '))}</small><h1>${escape(b.headline)}</h1><div class="nodes">${nodes}</div></div></section>`;
 }).join('');
 const words=JSON.stringify(source.words).replaceAll('<','\\u003c');
 const document=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; worker-src blob:; font-src data:; style-src 'unsafe-inline'; media-src 'self'; img-src 'self' data:"><title>Vektiss HyperFrames preview</title><style>
 *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${brand.background};color:${brand.text};font-family:Arial,sans-serif}
 #stage{position:relative;width:${width}px;height:${height}px;overflow:hidden}section{position:absolute;inset:0;display:none}.graphics{position:absolute;left:6%;top:7%;width:${wide?'44':'88'}%}small{text-transform:uppercase;letter-spacing:5px;font-size:22px;color:${brand.primary}}h1{font-size:72px;line-height:1.08;margin:32px 0 55px}.nodes{display:grid;gap:24px}.node{font-size:40px;line-height:1.2;padding:28px;border-left:8px solid ${brand.primary};background:${brand.text}0d;border-radius:16px}strong{color:${brand.primary}}[data-scene="comparison"] .nodes{grid-template-columns:1fr 1fr}[data-scene="statistic"] .node:first-child{font-size:100px;color:${brand.primary}}[data-scene="spotlight"] .node{font-size:64px;border:0;background:none}[data-full="true"] .graphics{width:80%;left:10%}[data-presenter="true"] .graphics{display:none}
 video{position:absolute;object-fit:${plan.templateId==='walkthrough'?'contain':'cover'};border-radius:32px;${wide?'left:55%;top:8%;width:41%;height:78%':'left:4%;top:57%;width:92%;height:36%'}}#captions{position:absolute;bottom:5%;left:7%;width:86%;text-align:center;font-size:${brand.captionStyle==='bold'?60:46}px;font-weight:800;z-index:10}#captions span{background:${brand.background};padding:8px 12px;border-radius:8px;display:inline-block}#captions em{font-style:normal;color:${brand.primary}}
 </style></head><body><div id="stage" data-composition-id="vektiss" data-start="0" data-duration="${source.duration}" data-width="${width}" data-height="${height}"><video id="presenter" class="clip" data-start="0" data-duration="${source.duration}" data-track-index="0" data-has-audio="true" src="source.mp4" playsinline></video>${scenes}<div id="captions"></div></div><script>
 const words=${words},sections=[...document.querySelectorAll('section')],video=document.querySelector('video'),caption=document.querySelector('#captions');
 function seek(t){
  sections.forEach(s=>{const active=t>=Number(s.dataset.from)&&t<Number(s.dataset.to);s.style.display=active?'block':'none';if(active){video.style.visibility=s.dataset.full==='true'?'hidden':'visible';const full=s.dataset.presenter==='true';video.style.inset=full?'0':'';video.style.width=full?'100%':'';video.style.height=full?'100%':'';s.querySelectorAll('[data-reveal]').forEach(n=>{const p=Math.max(0,Math.min(1,(t-Number(n.dataset.reveal))/.45));const e=1-Math.pow(1-p,3);n.style.opacity=String(e);n.style.transform='translateY('+((1-e)*35)+'px)';});}});
  caption.replaceChildren();if('${brand.captionStyle}'!=='none'){const at=words.findIndex(w=>t>=w.start&&t<w.end);if(at>=0){const box=document.createElement('span');words.slice(Math.floor(at/4)*4,Math.floor(at/4)*4+4).forEach(w=>{const el=document.createElement('${brand.captionStyle}'==='highlight'&&w===words[at]?'em':'b');el.textContent=('${brand.captionStyle}'==='bold'?w.text.toUpperCase():w.text)+' ';box.append(el);});caption.append(box);}}
 }
 window.__timelines={};window.__timelines['vektiss']={duration:()=>${source.duration},seek:t=>{seek(t);return window.__timelines.vektiss},pause:()=>{}};seek(0);
 ${sample?`window.addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='vektiss-seek'&&Number.isFinite(event.data.time))seek(Math.max(0,Math.min(${source.duration}-.001,event.data.time)));});`:''}
 </script></body></html>`;
 return sample?document.replace(/<video[^>]*><\/video>/,'<video poster="" style="background:#27364b"></video>').replace('</style>','#stage:after{content:"SAMPLE PRESENTER";position:absolute;top:80%;left:15%;font-size:30px;color:white;pointer-events:none}</style>'):document;
}
