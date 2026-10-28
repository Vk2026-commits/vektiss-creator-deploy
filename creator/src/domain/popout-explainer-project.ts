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
 return `<div class="editorial-eyebrow"><span class="editorial-mark" aria-hidden="true"></span><span>THE BIG PICTURE</span><span class="editorial-hairline" aria-hidden="true"></span></div><h1 style="--headline-size:${text.length>75?54:text.length>50?64:76}px"><span>${lead}</span>${accent?` <em>${accent}</em>`:''}</h1>`;
}

// Both layers use identical geometry: only the room layer is clipped.
// A clean alpha matte lets the presenter cross the panel edge without duplicating them.
export function popoutExplainerProject(source:EditSource,plan:EditProposal,brand:EditBrand,sample=false,illustrations:RenderIllustration[]=[]){
 const wide=editDimensions(plan.aspectRatio).width>editDimensions(plan.aspectRatio).height;
 let html=animatedExplainerProject(source,plan,brand,sample);
 let i=0;const beats=editStoryboard(plan,source);
 let graphicIndex=0;
 html=html.replace(/<svg class="diagram"[\s\S]*?<\/svg>/g,()=>{const index=graphicIndex++,b=beats[index],image=illustrations.find(a=>a.beatIndex===index&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.dataUri));return image?`<svg class="diagram editorial-scene" viewBox="0 0 900 640" role="img" aria-label="AI-generated conceptual illustration"><g data-ed-reveal="${b.start}"><image href="${image.dataUri}" x="130" y="0" width="640" height="640" preserveAspectRatio="xMidYMid meet"/></g></svg>`:editorialScene(source,b);});
 html=html.replace('const words=',`const seekEditorialScene=${seekEditorialScene.toString()};const words=`);
 html=html.replace('if(!active)return;', 'if(!active)return;seekEditorialScene(s,t);');
 html=html.replace(/<section data-from=/g,()=>`<section data-kind="${beats[i++].scene??'process'}" data-from=`);
 let headingIndex=0;
 html=html.replace(/<div class="rule"><\/div><h1>[\s\S]*?<\/h1>/g,()=>editorialHeadline(beats[headingIndex++].headline));
 const matte=`<video id="cutout" ${sample?'':'class="clip" src="presenter.webm"'} data-start="0" data-duration="${source.duration}" data-track-index="1" data-has-audio="false" muted playsinline></video>`;
 html=html.replace(/<video[^>]*><\/video>/,tag=>`<div id="room-layer">${tag}</div><div id="cutout-layer">${matte}</div>`);
 html=html.replace('</style>',`
 #stage{background-image:none;--editorial-accent:${brand.primary};--editorial-ink:${brand.text}}#room-layer,#cutout-layer{display:contents}video{left:${wide?'57':'7'}%;top:${wide?'6':'47'}%;width:${wide?'36':'86'}%;height:${wide?'88':'50'}%;object-fit:cover;object-position:50% 30%;border-radius:0;background:transparent}
 #room-layer video{clip-path:inset(26% 0 0 round 30px)}#cutout{z-index:3;clip-path:inset(0 0 0 round 0 0 30px 30px);pointer-events:none}
 section{z-index:4}.heading{left:7%;top:5%;width:${wide?'44':'86'}%}
 .editorial-eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:${wide?28:34}px;font:700 ${wide?15:19}px/1 Arial,sans-serif;letter-spacing:2.4px;color:${brand.text};opacity:.72}
 .editorial-mark{width:12px;height:15px;border:1.5px solid currentColor;border-radius:2px;position:relative;flex:none}.editorial-mark:after{content:"";position:absolute;left:3px;right:3px;top:4px;height:1px;background:currentColor;box-shadow:0 3px currentColor}
 .editorial-hairline{height:1px;flex:1;background:currentColor;opacity:.13;margin-left:12px}
 h1{font-size:var(--headline-size);line-height:1.02;font-weight:850;letter-spacing:-3.2px;text-wrap:balance;margin:0}
 h1>span{display:block}h1 em{display:block;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-style:italic;letter-spacing:-3px;color:${brand.primary};line-height:1.06;margin-top:5px}
 .diagram{left:6%;top:${wide?'30':'19'}%;height:${wide?'57':'29'}%;width:${wide?'46':'88'}%}
 [data-full="true"]{background:${brand.background}}[data-full="true"] .heading{left:8%;top:8%;width:84%}[data-full="true"] h1{font-size:calc(var(--headline-size) * ${wide?1.18:1.14})}
 [data-full="true"] .diagram{left:8%;top:${wide?'30':'28'}%;width:84%;height:${wide?'58':'48'}%}
 #stage[data-mode="presenter"]:after{content:"";position:absolute;z-index:4;inset:65% 0 0;pointer-events:none;background:linear-gradient(transparent,#07111b66)}
 [data-kind="document"] .node rect{rx:6;stroke-width:1;fill:${brand.text}}[data-kind="document"] .label{color:${brand.background}}[data-kind="document"] .badge{r:0}[data-kind="document"] .number{display:none}
 #stage[data-mode="presenter"] #room-layer video{clip-path:none}#stage[data-mode="presenter"] #cutout-layer,#stage[data-mode="full"] #cutout-layer{display:none}
 #stage[data-mode="full"] #room-layer{display:none}
 #captions{z-index:5;bottom:${wide?'5':'5'}%;font-size:${wide?40:44}px;letter-spacing:-.5px}#captions>span{padding:10px 16px;box-shadow:0 3px 18px #0000000a}#stage[data-mode="full"] #captions>span{background:transparent;box-shadow:none}
 ${editorialSceneStyles}
 </style>`);
 html=html.replace('const full=s.dataset.presenter',`document.querySelector('#stage').dataset.mode=s.dataset.presenter==='true'?'presenter':s.dataset.full==='true'?'full':'panel';const full=s.dataset.presenter`);
 // HyperFrames replaces video pixels with sibling images during export. Hide the parent
 // layer so both the live video and its decoded replacement obey the scene mode.
 // The stage mode is reset for every seek, including seeking backwards.
 return html;
}
