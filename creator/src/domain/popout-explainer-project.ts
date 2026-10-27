import {animatedExplainerProject} from './animated-explainer-project.ts';
import {editStoryboard,type EditSource,type EditProposal} from './edit-templates.ts';
import {editDimensions} from './edit-format.ts';
import type {EditBrand} from './edit-brand.ts';

// Both layers use identical geometry: only the room layer is clipped.
// A clean alpha matte lets the presenter cross the panel edge without duplicating them.
export function popoutExplainerProject(source:EditSource,plan:EditProposal,brand:EditBrand,sample=false){
 const wide=editDimensions(plan.aspectRatio).width>editDimensions(plan.aspectRatio).height;
 let html=animatedExplainerProject(source,plan,brand,sample);
 let i=0;const beats=editStoryboard(plan,source);
 html=html.replace(/<section data-from=/g,()=>`<section data-kind="${beats[i++].scene??'process'}" data-from=`);
 const matte=`<video id="cutout" ${sample?'':'class="clip" src="presenter.webm"'} data-start="0" data-duration="${source.duration}" data-track-index="1" data-has-audio="false" muted playsinline></video>`;
 html=html.replace('</video>','</video>'+matte);
 html=html.replace('</style>',`
 #stage{background-image:none}video{left:${wide?'57':'7'}%;top:${wide?'6':'47'}%;width:${wide?'36':'86'}%;height:${wide?'88':'50'}%;object-fit:cover;object-position:50% 30%;border-radius:0;background:transparent}
 video:first-child{clip-path:inset(26% 0 0 round 30px)}#cutout{z-index:3;clip-path:inset(0 0 0 round 0 0 30px 30px);pointer-events:none}
 section{z-index:4}.heading{top:5%;width:${wide?'46':'86'}%}h1{font-size:${wide?72:76}px;font-weight:900;letter-spacing:-3px}.diagram{top:${wide?'28':'17'}%;height:${wide?'58':'35'}%;width:${wide?'48':'88'}%}
 [data-kind="document"] .node rect{rx:6;stroke-width:1;fill:${brand.text}}[data-kind="document"] .label{color:${brand.background}}[data-kind="document"] .badge{r:0}[data-kind="document"] .number{display:none}
 #stage[data-mode="presenter"] video:first-child{clip-path:none}#stage[data-mode="presenter"] #cutout,#stage[data-mode="full"] #cutout{visibility:hidden}
 #captions{z-index:5;bottom:${wide?'4':'2'}%}
 </style>`);
 html=html.replace('const full=s.dataset.presenter',`document.querySelector('#stage').dataset.mode=s.dataset.presenter==='true'?'presenter':s.dataset.full==='true'?'full':'panel';const full=s.dataset.presenter`);
 // The stage mode is reset for every seek, including seeking backwards.
 return html;
}
