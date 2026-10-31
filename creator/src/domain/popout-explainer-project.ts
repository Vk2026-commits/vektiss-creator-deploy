import {editorialCaptions} from './editorial-captions.ts';
import {directedHeadlineTime} from './directed-plan-timing.ts';
import type {RenderIllustration} from './edit-illustrations.ts';
import {editorialScene,editorialSceneStyles,seekEditorialScene} from './editorial-scenes.ts';
import {animatedExplainerProject} from './animated-explainer-project.ts';
import {editStoryboard,type EditSource,type EditProposal} from './edit-templates.ts';
import {editDimensions} from './edit-format.ts';
import type {EditBrand} from './edit-brand.ts';

const escapeHeadline=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function editorialHeadline(text:string){
 const words=text.trim().split(/\s+/);
 // Preserve the exact approved headline. Typography supplies emphasis, never new copy.
 const split=words.length<3?words.length:Math.max(1,words.length-Math.min(3,Math.ceil(words.length/2)));
 const lead=escapeHeadline(words.slice(0,split).join(' ')),accent=escapeHeadline(words.slice(split).join(' '));
 return `<div class="editorial-eyebrow"><span class="editorial-mark" aria-hidden="true"></span><span>THE BIG PICTURE</span><span class="editorial-hairline" aria-hidden="true"></span></div><h1 style="--headline-size:${text.length>75?54:text.length>50?64:76}px"><span class="headline-mask"><span class="headline-lead">${lead}</span></span>${accent?` <span class="headline-mask"><em>${accent}</em></span>`:''}</h1>`;
}

/** Pure time-derived motion: no accumulated transforms, timers, or playback state. */
export function popoutMotionState(time:number,start:number,end:number,presenter:boolean,changesPresenter:boolean){
 const clamp=(n:number)=>Math.max(0,Math.min(1,n));
 // Solve the original cubic-bezier(.16,1,.3,1) in time, not parameter space.
 const ease=(n:number)=>{const x=clamp(n);let lo=0,hi=1;for(let i=0;i<16;i++){const u=(lo+hi)/2,v=1-u,bx=3*v*v*u*.16+3*v*u*u*.3+u*u*u;if(bx<x)lo=u;else hi=u;}const u=(lo+hi)/2;return x===0?0:x===1?1:1-Math.pow(1-u,3);};
 const local=time-start,duration=Math.max(.001,end-start),titleDelay=presenter?.18:.04;
 return {lead:ease((local-titleDelay)/.5),italic:ease((local-titleDelay-.14)/.52),eyebrow:ease(local/.35),
  camera:presenter?1+.035*ease(local/Math.max(1.3,duration)):1,
  wipe:changesPresenter&&local>=0&&local<.52?clamp(local/.52):-1,
  graphicScale:1+.012*clamp(local/duration)};
}

// Both layers use identical geometry: only the room layer is clipped.
// A clean alpha matte lets the presenter cross the panel edge without duplicating them.
export function popoutExplainerProject(source:EditSource,plan:EditProposal,brand:EditBrand,sample=false,illustrations:RenderIllustration[]=[]){
 const wide=editDimensions(plan.aspectRatio).width>editDimensions(plan.aspectRatio).height;
 let html=animatedExplainerProject(source,plan,brand,sample);
 let i=0;const beats=editStoryboard(plan,source);
 let graphicIndex=0;
 html=html.replace(/<svg class="diagram"[\s\S]*?<\/svg>/g,()=>{const index=graphicIndex++,b=beats[index],image=illustrations.find(a=>a.beatIndex===index&&a.nodeIndex===undefined&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.dataUri));return image?`<svg class="diagram editorial-scene" viewBox="0 0 900 640" role="img" aria-label="AI-generated conceptual illustration"><g data-ed-reveal="${b.start}"><image href="${image.dataUri}" x="130" y="0" width="640" height="640" preserveAspectRatio="xMidYMid meet"/></g></svg>`:editorialScene(source,b,Object.fromEntries(illustrations.filter(a=>a.beatIndex===index&&a.nodeIndex!==undefined).map(a=>[b.graphics!.nodes[a.nodeIndex!].label,a.dataUri])));});
 html=html.replace('const words=',`const seekEditorialScene=${seekEditorialScene.toString()};const words=`);
 html=html.replace('if(!active)return;', 'if(!active)return;seekEditorialScene(s,t);');
 html=html.replace(/<section data-from=/g,()=>{const beat=beats[i++];return `<section data-headline-at="${directedHeadlineTime(beat,source)}" data-layout="${beat.layout}" data-kind="${beat.scene??'process'}" data-from=`;});
 html=html.replace("active&&s.dataset.presenter!=='true'?'block':'none'","active?'block':'none'");
 let headingIndex=0;
 html=html.replace(/<div class="rule"><\/div><h1>[\s\S]*?<\/h1>/g,()=>editorialHeadline(beats[headingIndex++].headline));
 const matte=`<video id="cutout" ${sample?'':'class="clip" src="presenter.webm"'} data-start="0" data-duration="${source.duration}" data-track-index="1" data-has-audio="false" muted playsinline></video>`;
 html=html.replace(/<video[^>]*><\/video>/,tag=>`<div id="room-layer">${tag}</div><div id="cutout-layer">${matte}</div>`);
 html=html.replace('</style>',`
 #stage{background-image:none;--editorial-accent:${brand.primary};--editorial-ink:${brand.text}}#room-layer,#cutout-layer{position:absolute;inset:0;transform-origin:50% 45%;pointer-events:none}#room-layer{z-index:1}#cutout-layer{z-index:3}video{left:${wide?'57':'7'}%;top:${wide?'6':'47'}%;width:${wide?'36':'86'}%;height:${wide?'88':'50'}%;object-fit:cover;object-position:50% 30%;border-radius:0;background:transparent}
 #room-layer video{clip-path:inset(26% 0 0 round 30px)}#cutout{z-index:3;clip-path:inset(0 0 0 round 0 0 30px 30px);pointer-events:none}
 section{z-index:4}.heading{left:7%;top:5%;width:${wide?'44':'86'}%}
 .editorial-eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:${wide?28:34}px;font:700 ${wide?15:19}px/1 Arial,sans-serif;letter-spacing:2.4px;color:${brand.text};opacity:.72}
 .editorial-mark{width:12px;height:15px;border:1.5px solid currentColor;border-radius:2px;position:relative;flex:none}.editorial-mark:after{content:"";position:absolute;left:3px;right:3px;top:4px;height:1px;background:currentColor;box-shadow:0 3px currentColor}
 .editorial-hairline{height:1px;flex:1;background:currentColor;opacity:.13;margin-left:12px}
 h1{font-size:var(--headline-size);line-height:1.02;font-weight:850;letter-spacing:-3.2px;text-wrap:balance;margin:0}
 h1>.headline-mask{display:block;overflow:hidden;padding-bottom:.09em;margin-bottom:-.09em}.headline-lead,h1 em{display:block;will-change:transform}h1 em{display:block;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-style:italic;letter-spacing:-3px;color:${brand.primary};line-height:1.06;margin-top:5px}
 .diagram{left:6%;top:${wide?'30':'19'}%;height:${wide?'61':'32'}%;width:${wide?'49':'92'}%}
 [data-full="true"]{background:${brand.background}}[data-full="true"] .heading{left:8%;top:8%;width:84%}[data-full="true"] h1{font-size:calc(var(--headline-size) * ${wide?1.18:1.14})}
 [data-full="true"] .diagram{left:8%;top:${wide?'30':'28'}%;width:84%;height:${wide?'58':'48'}%}
 #stage[data-mode="presenter"]:after{content:"";position:absolute;z-index:4;inset:65% 0 0;pointer-events:none;background:linear-gradient(transparent,#07111b66)}
 [data-kind="document"] .node rect{rx:6;stroke-width:1;fill:${brand.text}}[data-kind="document"] .label{color:${brand.background}}[data-kind="document"] .badge{r:0}[data-kind="document"] .number{display:none}
 #stage[data-mode="presenter"] #room-layer video{clip-path:none}#stage[data-mode="presenter"] #cutout-layer,#stage[data-mode="full"] #cutout-layer{display:none}
 #stage[data-mode="full"] #room-layer{display:none}
 #captions{z-index:7;bottom:${wide?'5':'5'}%;font-size:${wide?40:44}px;letter-spacing:-.5px}#captions>span{padding:10px 16px;box-shadow:0 3px 18px #0000000a}#stage[data-mode="full"] #captions>span{background:transparent;box-shadow:none}
 #stage[data-mode="presenter"] #captions>span{background:#101821dc;color:white;box-shadow:none}
 #stage[data-mode="presenter"] #captions em{color:#9dd3ff}
 #stage[data-mode="panel"] #captions>span{background:${brand.background};box-shadow:0 2px 12px #00000012}#stage[data-layout="split"][data-mode="panel"] #captions>span{background:transparent;box-shadow:none}
 #stage[data-layout="split"][data-mode="panel"] #captions{bottom:${wide?'7':'17'}%;left:7%;width:${wide?'52':'34'}%;font-size:${wide?'38':'39'}px;text-align:left}
 #stage[data-mode="full"] #captions{bottom:12%}
 #editorial-wipe{position:absolute;z-index:6;left:-20%;top:-10%;width:140%;height:120%;background:${brand.background};border-right:8px solid ${brand.primary};pointer-events:none;display:none}
 /* Presenter hook has its own editorial title, never a second graphic person. */
 [data-presenter="true"] .diagram,[data-presenter="true"] .editorial-eyebrow{display:none}
 [data-presenter="true"] .heading{top:auto;bottom:19%;left:8%;width:${wide?'60':'84'}%;color:white;text-shadow:0 2px 15px #0005}
 [data-presenter="true"] h1{font-size:${wide?'68':'76'}px}[data-presenter="true"] h1 em{color:#9dd3ff}
 #stage[data-layout="split"][data-mode="panel"] video{left:${wide?'65':'43'}%;top:${wide?'36':'65'}%;width:${wide?'28':'50'}%;height:${wide?'58':'32'}%}
 [data-layout="split"] .diagram{top:${wide?'26':'21'}%;height:${wide?'62':'40'}%;width:${wide?'55':'88'}%}
 [data-layout="split"] .heading{width:${wide?'54':'86'}%}
 ${editorialSceneStyles}
 /* Approved editorial framing: preserve source aspect and keep one aligned presenter. */
 ${wide?'':`#stage[data-mode="panel"] video{left:13%;top:41.67%;width:74%;height:74%;object-fit:fill;object-position:center}#stage[data-mode="panel"] #room-layer video{clip-path:inset(24% 0 0 round 30px)}#stage[data-mode="panel"] .heading{top:7.4%;left:7.4%;width:85%}#stage[data-mode="panel"] .diagram{left:5.6%;top:22%;width:88.8%;height:21.5%}#stage[data-mode="panel"] .diagram[data-editorial-kind="process"]{top:20%;height:26%}#stage[data-mode="panel"] #captions{top:47%;bottom:auto;left:6%;width:88%;font-size:58px;text-align:center}#stage[data-mode="panel"] #captions>span{background:transparent;box-shadow:none;padding:0}`}
 #presenter-shade{position:absolute;z-index:3;pointer-events:none;left:${wide?'57%':'13%'};width:${wide?'36%':'74%'};top:${wide?'35%':'70%'};bottom:0;background:linear-gradient(to bottom,transparent 0%,rgba(8,16,30,.18) 48%,rgba(8,16,30,.7) 100%)}
 #stage[data-mode="full"] #presenter-shade{display:none}#stage[data-mode="presenter"] #presenter-shade{left:0;width:100%;top:55%}
 </style>`);
 html=html.replace('const full=s.dataset.presenter',`document.querySelector('#stage').dataset.layout=s.dataset.layout;document.querySelector('#stage').dataset.mode=s.dataset.presenter==='true'?'presenter':s.dataset.full==='true'?'full':'panel';const full=s.dataset.presenter`);
 html=html.replace('<div id="captions">','<div id="presenter-shade" aria-hidden="true"></div><div id="editorial-wipe" aria-hidden="true"></div><div id="captions">');
 // Wrap the shared renderer, then direct the same DOM for preview and export.
 html=html.replace('function seek(t){','function seekBase(t){');
 html=html.replace('window.__timelines=',`const popoutMotionState=${popoutMotionState.toString()};
 function seek(t){seekBase(t);${brand.captionStyle==='none'?'':`const phrase=${JSON.stringify(editorialCaptions(source.words)).replaceAll('<','\\u003c')}.find(p=>t>=p.start&&t<p.end);caption.replaceChildren();if(phrase){const line=document.createElement('span');const current=wordAt(words,t);words.forEach((w,i)=>{if(w.start<phrase.start||w.start>=phrase.end)return;const token=document.createElement(i===current&&'${brand.captionStyle}'==='highlight'?'em':'b');token.textContent=('${brand.captionStyle}'==='bold'?w.text.toUpperCase():w.text)+' ';line.append(token);});caption.append(line);}`}const sections=Array.from(document.querySelectorAll('section')),index=sections.findIndex(s=>t>=+s.dataset.from&&t<+s.dataset.to),s=sections[index],wipe=document.querySelector('#editorial-wipe'),room=document.querySelector('#room-layer');wipe.style.display='none';room.style.transform='none';if(!s)return;const presenter=s.dataset.presenter==='true',previous=sections[index-1],motion=popoutMotionState(t,+s.dataset.from,+s.dataset.to,presenter,!!previous&&(previous.dataset.presenter==='true')!==presenter);s.style.opacity='1';const heading=s.querySelector('.heading');heading.style.opacity='1';heading.style.transform='none';heading.style.visibility=t<+s.dataset.headlineAt?'hidden':'visible';const lead=s.querySelector('.headline-lead'),italic=s.querySelector('h1 em'),eyebrow=s.querySelector('.editorial-eyebrow');lead.style.transform='translateY('+((1-motion.lead)*110)+'%)';if(italic)italic.style.transform='translateY('+((1-motion.italic)*110)+'%)';if(eyebrow)eyebrow.style.opacity=String(motion.eyebrow*.72);room.style.transform='scale('+motion.camera+')';const diagram=s.querySelector('.diagram');if(diagram){diagram.style.transform='scale('+motion.graphicScale+')';diagram.style.transformOrigin='50% 50%';}if(motion.wipe>=0){wipe.style.display='block';wipe.style.transform='translateX('+(-130+260*motion.wipe)+'%) skewX(-10deg)';}}
 window.__timelines=`);
 // HyperFrames replaces video pixels with sibling images during export. Hide the parent
 // layer so both the live video and its decoded replacement obey the scene mode.
 // The stage mode is reset for every seek, including seeking backwards.
 return html;
}
