import {popoutExplainerProject} from './popout-explainer-project.ts';
import {animatedExplainerProject} from './animated-explainer-project.ts';
import {chartsComparisonsProject} from './charts-comparisons-project.ts';
import {glassCardsProject} from './glass-cards-project.ts';
import {editStoryboard, validateEditProposal, type EditSource, type EditProposal} from './edit-templates.ts';
import {editBrandSchema, type EditBrand} from './edit-brand.ts';
import {captionWordAt} from './caption-timing.ts';
import {editDimensions} from './edit-format.ts';
import {phoneMockupProject} from './phone-mockup-project.ts';
import {paperCutoutTreatment} from './paper-cutout-project.ts';
import {cleanTechProject} from './clean-tech-project.ts';
import type {RenderLogo} from './logo-assets.ts';

// Local authoring bridge only. Never accept executable HTML or URLs from the model.
export const HYPERFRAMES_VERSION='0.8.206';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function hyperframesProject(source:EditSource,raw:EditProposal,rawBrand:EditBrand,sample=false,logos:RenderLogo[]=[]){
 const plan=validateEditProposal(raw,source,raw.templateId);
 const brand=editBrandSchema.parse(rawBrand);
 const {width,height}=editDimensions(plan.aspectRatio);
 const wide=width>height;
 if(plan.templateId==='popout-explainer')return popoutExplainerProject(source,plan,brand,sample);
 if(plan.templateId==='animated-explainer')return animatedExplainerProject(source,plan,brand,sample);
 if(plan.templateId==='charts-comparisons')return chartsComparisonsProject(source,plan,brand,sample);
 if(plan.templateId==='glass-cards')return glassCardsProject(source,plan,brand,sample);
 if(plan.templateId==='clean-tech')return cleanTechProject(source,plan,brand,sample,logos);
 if(plan.templateId==='phone-mockup')return phoneMockupProject(source,plan,brand,sample);
 if(plan.templateId==='paper-cutout')return paperCutoutTreatment(talkingHeadProject(source,plan,brand,width,height,sample),brand,wide,sample);
 if(plan.templateId==='hyperframes-motion')return talkingHeadProject(source,plan,brand,width,height,sample);
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
 const captionWordAt=${captionWordAt.toString()};
 const words=${words},sections=[...document.querySelectorAll('section')],video=document.querySelector('video'),caption=document.querySelector('#captions');
 function seek(t){
  sections.forEach(s=>{const active=t>=Number(s.dataset.from)&&t<Number(s.dataset.to);s.style.display=active?'block':'none';if(active){video.style.visibility=s.dataset.full==='true'?'hidden':'visible';const full=s.dataset.presenter==='true';video.style.inset=full?'0':'';video.style.width=full?'100%':'';video.style.height=full?'100%':'';s.querySelectorAll('[data-reveal]').forEach(n=>{const p=Math.max(0,Math.min(1,(t-Number(n.dataset.reveal))/.45));const e=1-Math.pow(1-p,3);n.style.opacity=String(e);n.style.transform='translateY('+((1-e)*35)+'px)';});}});
  caption.replaceChildren();if('${brand.captionStyle}'!=='none'){const at=captionWordAt(words,t);if(at>=0){const box=document.createElement('span');words.slice(Math.floor(at/4)*4,Math.floor(at/4)*4+4).forEach(w=>{const el=document.createElement('${brand.captionStyle}'==='highlight'&&w===words[at]?'em':'b');el.textContent=('${brand.captionStyle}'==='bold'?w.text.toUpperCase():w.text)+' ';box.append(el);});caption.append(box);}}
 }
 window.__timelines={};window.__timelines['vektiss']={duration:()=>${source.duration},seek:t=>{seek(t);return window.__timelines.vektiss},pause:()=>{}};seek(0);
 ${sample?`window.addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='vektiss-seek'&&Number.isFinite(event.data.time))seek(Math.max(0,Math.min(${source.duration}-.001,event.data.time)));});`:''}
 </script></body></html>`;
 return sample?document.replace(/<video[^>]*><\/video>/,'<video poster="" style="background:#27364b"></video>').replace('</style>','#stage:after{content:"SAMPLE PRESENTER";position:absolute;top:80%;left:15%;font-size:30px;color:white;pointer-events:none}</style>'):document;
}

// Trusted visual vocabulary: the planner supplies words and relationships, never HTML.
export function talkingHeadProject(source:EditSource,plan:EditProposal,brand:EditBrand,width:number,height:number,sample:boolean){
 const wide=width>height;
 const scenes=editStoryboard(plan,source).map((b,i)=>{
  const kind=b.scene??(b.visual==='typography'?'spotlight':b.visual==='steps'?'process':'network');
  // In Motion, layout describes the footage; only an explicit presenter visual
  // suppresses overlays. Typography over a presenter remains visible.
  const presenter=b.visual==='presenter';
  const nodes=b.graphics?.nodes??[];
  const reveal=(j:number)=>nodes[j].revealWord===undefined?Math.min(b.end-.01,b.start+.45+j*.5):source.words[nodes[j].revealWord!].start;
  const links=(b.graphics?.links??[]).map(l=>`<line data-reveal="${Math.max(reveal(l.from),reveal(l.to))}" x1="${nodes[l.from].x}" y1="${nodes[l.from].y}" x2="${nodes[l.to].x}" y2="${nodes[l.to].y}" pathLength="1"/>`).join('');
  const cards=nodes.map((n,j)=>`<div class="card ${n.shape}" data-reveal="${reveal(j)}" style="--order:${j};--x:${n.x}%;--y:${n.y}%"><span class="index">${String(j+1).padStart(2,'0')}</span><span>${escape(n.label)}</span></div>`).join('');
  const headline=b.headline.split(/\s+/).filter(Boolean).map((w,j)=>`<span data-reveal="${Math.min(b.end-.01,b.start+j*.085)}">${escape(w)} </span>`).join('');
  return `<section data-kind="${kind}" data-presenter="${presenter}" data-from="${b.start}" data-to="${b.end}" data-index="${i}"><div class="scrim"></div><div class="editorial"><h1>${headline}</h1><div class="visual"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>${cards}</div></div><div class="beat-line"></div></section>`;
 }).join('');
 const words=JSON.stringify(source.words).replaceAll('<','\\u003c');
 return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; worker-src blob:; font-src data:; style-src 'unsafe-inline'; media-src 'self'; img-src 'self' data:"><title>Vektiss Talking Head Motion</title><style>
 *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${brand.background};font-family:Arial,sans-serif;color:${brand.text}}#stage{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#151920}video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform-origin:50% 45%}section{position:absolute;inset:0;display:none;pointer-events:none}.scrim{position:absolute;inset:0;background:linear-gradient(180deg,#0009,transparent 36%,transparent 48%,#0009)}.editorial{position:absolute;inset:0}h1{position:absolute;left:7%;top:5%;width:86%;margin:0;color:white;font-size:${wide?86:88}px;line-height:1.03;letter-spacing:-3px;font-weight:900;text-shadow:0 3px 20px #0009;overflow-wrap:anywhere}h1 span{display:inline-block;white-space:pre-wrap}h1 span:last-child{color:${brand.primary};background:${brand.background};padding:0 .12em;box-decoration-break:clone;border-radius:5px}.visual{position:absolute;left:7%;top:${wide?'44':'60'}%;width:86%;height:${wide?'34':'23'}%;perspective:1400px;display:flex;align-items:center;justify-content:center;gap:22px}.card{position:relative;flex:1;min-width:0;padding:24px;border:1px solid ${brand.primary}55;border-radius:18px;background:${brand.background};color:${brand.text};font-size:${wide?36:32}px;line-height:1.15;font-weight:800;box-shadow:0 16px 38px #0005;overflow-wrap:anywhere;transform-origin:50% 100%}.index{display:block;font-size:18px;letter-spacing:3px;margin-bottom:14px;color:${brand.primary}}svg{position:absolute;width:100%;height:100%;overflow:visible;pointer-events:none}line{stroke:${brand.primary};stroke-width:1;stroke-dasharray:1;vector-effect:non-scaling-stroke;filter:drop-shadow(0 2px 2px #0005)}.beat-line{position:absolute;left:7%;top:3%;width:8%;height:6px;background:${brand.primary};transform-origin:left}
 [data-kind="document"] .visual{left:7%;width:86%;top:${wide?'42':'56'}%;height:${wide?'37':'28'}%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:26px}[data-kind="document"] .card{position:relative;min-height:0;padding:${wide?'20':'24'}px;border-radius:8px;border-top:7px solid ${brand.primary};transform-origin:50% 100%;font-size:${wide?'30':'30'}px;display:flex;flex-direction:column;justify-content:center}[data-kind="document"] .card .index{margin-bottom:8px}[data-kind="document"] .card:only-of-type{grid-column:1/-1;max-width:70%;justify-self:center}[data-kind="document"] .card .index:after{content:'';display:block;margin-top:8px;width:45%;height:3px;background:${brand.primary}55}
 [data-kind="network"] .visual{display:block}[data-kind="network"] .card{position:absolute;left:var(--x);top:var(--y);width:30%;font-size:${wide?30:25}px;padding:18px}[data-kind="network"] .circle{border-radius:50%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;text-align:center;width:${wide?'14':'23'}%}[data-kind="network"] .index{display:none}
 [data-kind="timeline"] .visual:before,[data-kind="process"] .visual:before{content:'';position:absolute;left:3%;right:3%;top:50%;height:4px;background:${brand.primary}}[data-kind="timeline"] .card{border-radius:3px;border-top:8px solid ${brand.primary}}[data-kind="comparison"] .card{align-self:stretch;display:flex;flex-direction:column;justify-content:center}[data-kind="comparison"] .card:nth-of-type(even){background:${brand.primary};color:${brand.background}}[data-kind="comparison"] .card:nth-of-type(even) .index{color:inherit}[data-kind="statistic"] .card{font-size:${wide?70:56}px;border:0;background:${brand.background};text-align:center}[data-kind="spotlight"] .visual{display:none}[data-kind="spotlight"] h1{top:${wide?'55':'63'}%;font-size:${wide?104:96}px;width:86%}[data-presenter="true"] .editorial,[data-presenter="true"] .beat-line{display:none}[data-presenter="true"] .scrim{opacity:.35}
 ${!wide?`.card{font-size:52px;padding:18px;line-height:1.1}.index{font-size:24px}[data-kind="document"] .card{font-size:52px;padding:18px;line-height:1.08}[data-kind="document"] .card .index:after{display:none}[data-kind="network"] .card{font-size:40px;padding:14px}[data-kind="network"] .circle{width:27%}[data-kind="comparison"] .card{font-size:56px;align-self:center;min-height:48%;padding:20px}[data-kind="statistic"] .card{font-size:80px}`:''}
 ${wide?'':'[data-kind="process"] .visual,[data-kind="timeline"] .visual{flex-direction:column;gap:12px}[data-kind="process"] .card,[data-kind="timeline"] .card{width:100%;flex:0 1 auto;padding:12px 24px;font-size:48px;text-align:center}[data-kind="process"] .index,[data-kind="timeline"] .index{display:none}[data-kind="process"] .visual:before,[data-kind="timeline"] .visual:before{left:50%;right:auto;top:0;bottom:0;width:4px;height:100%}'}
 #captions{position:absolute;bottom:6%;left:8%;width:84%;text-align:center;font-size:${brand.captionStyle==='bold'?(wide?48:52):(wide?40:44)}px;line-height:1.25;font-weight:800;z-index:10}#captions>span{background:${brand.background};color:${brand.text};padding:9px 15px;border-radius:10px;display:inline-block;box-shadow:0 3px 18px #0005}#captions em{font-style:normal;color:${brand.primary}}
 ${sample?'video{background:radial-gradient(ellipse at 50% 40%,#516176,#192433)}#sample-label{position:absolute;left:35%;top:43%;color:white;font-size:28px;text-align:center}':''}
 </style></head><body><div id="stage" data-composition-id="vektiss" data-start="0" data-duration="${source.duration}" data-width="${width}" data-height="${height}">${sample?'<video></video><div id="sample-label">SAMPLE PRESENTER</div>':`<video id="presenter" class="clip" data-start="0" data-duration="${source.duration}" data-track-index="0" data-has-audio="true" src="source.mp4" playsinline></video>`}${scenes}<div id="captions"></div></div><script>
 const captionWordAt=${captionWordAt.toString()};
 const words=${words},sections=[...document.querySelectorAll('section')],video=document.querySelector('video'),caption=document.querySelector('#captions');
 const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>1-Math.pow(1-clamp(n),3);
 function seek(raw){const t=Math.max(0,Math.min(${source.duration}-.0001,Number.isFinite(raw)?raw:0));
 sections.forEach(s=>{const start=Number(s.dataset.from),end=Number(s.dataset.to),active=t>=start&&t<end;s.style.display=active?'block':'none';if(!active)return;const elapsed=t-start,exit=clamp((end-t)/.2);s.style.opacity=String(exit);video.style.transform='scale('+(1+.035*ease(elapsed/Math.max(1,end-start)))+')';s.querySelector('.beat-line').style.transform='scaleX('+ease(elapsed/.65)+')';
 s.querySelectorAll('[data-reveal]').forEach(n=>{const e=ease((t-Number(n.dataset.reveal))/.55);n.style.opacity=String(e);if(n.tagName.toLowerCase()==='line'){n.style.strokeDashoffset=String(1-e);return;}const card=n.classList.contains('card'),order=Number(n.style.getPropertyValue('--order'))||0;let transform='translateY('+((1-e)*48)+'px) scale('+(0.96+.04*e)+')';if(card&&s.dataset.kind==='document')transform='translateY('+((1-e)*40)+'px) rotateY('+((order%2?5:-5)*e)+'deg) rotateZ('+((order%2?.6:-.6)*e)+'deg)';if(card&&s.dataset.kind==='network')transform='translate(-50%,-50%) '+transform;n.style.transform=transform;});});
 caption.replaceChildren();if('${brand.captionStyle}'!=='none'){const at=captionWordAt(words,t);if(at>=0){const box=document.createElement('span');words.slice(Math.floor(at/4)*4,Math.floor(at/4)*4+4).forEach(w=>{const el=document.createElement('${brand.captionStyle}'==='highlight'&&w===words[at]?'em':'b');el.textContent=('${brand.captionStyle}'==='bold'?w.text.toUpperCase():w.text)+' ';box.append(el);});caption.append(box);}}
 }
 window.__timelines={vektiss:{duration:()=>${source.duration},seek:t=>{seek(t);return window.__timelines.vektiss},pause:()=>{}}};seek(0);
 ${sample?`window.addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='vektiss-seek'&&Number.isFinite(event.data.time))seek(event.data.time);});`:''}
 </script></body></html>`;
}
