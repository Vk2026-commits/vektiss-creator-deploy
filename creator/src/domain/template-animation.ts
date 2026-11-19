import {z} from 'zod';

// Versioned, bounded rendering controls. No caller HTML, CSS, JavaScript or URLs.
export const animationTemplate=z.enum(['tier-list','hyperframes-motion','animated-explainer','charts-comparisons','glass-cards','clean-tech']);
export const templateAnimation=z.object({
 version:z.literal(1).default(1),
 entrance:z.enum(['fade','rise','slide','pop']).default('rise'),
 duration:z.number().min(.15).max(1.2).default(.45),
 distance:z.number().min(0).max(100).default(32),
 easing:z.enum(['linear','out-cubic','out-quint']).default('out-cubic'),
 exitDuration:z.number().min(0).max(.5).default(.2),
 headlineScale:z.number().min(.8).max(1.2).default(1),
 cardRadius:z.number().min(0).max(32).default(12),
 boardTop:z.number().min(55).max(65).default(59),
 boardHeight:z.number().min(22).max(30).default(30),
 captionTop:z.number().min(40).max(50).default(47),
}).strict();
export type TemplateAnimation=z.infer<typeof templateAnimation>;
export const defaultTemplateAnimation=templateAnimation.parse({});
export const templateDesignInput=z.object({template:animationTemplate,name:z.string().trim().min(1).max(80),notes:z.string().max(2000).default(''),animation:templateAnimation}).strict();
export const templateDesign=z.object({id:z.string().uuid(),revision:z.number().int().positive(),savedAt:z.string(),design:templateDesignInput,published:z.object({revision:z.number().int().positive(),design:templateDesignInput}).optional()}).strict();
export type TemplateDesign=z.infer<typeof templateDesign>;

/** Runs after the trusted renderer's seek; word anchors and content stay unchanged. */
export function animationFrame(raw:number,start:number,a:TemplateAnimation){
 const p=Math.max(0,Math.min(1,(raw-start)/a.duration));
 const e=a.easing==='linear'?p:1-Math.pow(1-p,a.easing==='out-quint'?5:3);
 return {opacity:e,x:a.entrance==='slide'?(1-e)*a.distance:0,y:a.entrance==='rise'?(1-e)*a.distance:0,scale:a.entrance==='pop'?.85+.15*e:1};
}
export function applyTemplateAnimation(html:string,raw:TemplateAnimation|undefined,template:string,wide:boolean){
 if(!raw)return html;
 animationTemplate.parse(template);const a=templateAnimation.parse(raw);
 const code=`<script>(function(){
 const a=${JSON.stringify(a)},frame=${animationFrame.toString()};
 const original=seek;
 const elements=[...document.querySelectorAll('[data-reveal]')];
 document.querySelectorAll('h1').forEach(el=>{el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)*a.headlineScale)+'px';});
 document.querySelectorAll('.card,.compare-card,.item,.glass,.cards>div').forEach(el=>el.style.borderRadius=a.cardRadius+'px');
 ${template==='tier-list'&&!wide?"const board=document.querySelector('#board');board.style.top=a.boardTop+'%';board.style.height=a.boardHeight+'%';document.querySelector('#captions').style.top=a.captionTop+'%';":''}
 seek=function(t){original(t);
 document.querySelectorAll('section[data-from]').forEach(s=>{if(t<+s.dataset.from||t>=+s.dataset.to)return;const end=+s.dataset.to;s.style.opacity=String(a.exitDuration?Math.max(0,Math.min(1,(end-t)/a.exitDuration)):1);if('${template}'==='glass-cards')s.style.transform='none';});
 elements.forEach(el=>{const f=frame(t,+el.dataset.reveal,a);el.style.opacity=String(f.opacity);
 if(el.classList.contains('edge')){el.querySelectorAll('path').forEach(p=>p.style.strokeDashoffset=String(1-f.opacity));return;}
 if(el.tagName.toLowerCase()==='line'){el.style.strokeDashoffset=String(1-f.opacity);return;}
 if(el.namespaceURI==='http://www.w3.org/2000/svg'){if(el.dataset.x!==undefined){el.setAttribute('transform','translate('+(+el.dataset.x+f.x)+' '+(+el.dataset.y+f.y)+') scale('+f.scale+')');}return;}
 const positioned=el.classList.contains('card')&&el.closest('[data-kind="network"]');
 el.style.transform=(positioned?'translate(-50%,-50%) ':'')+'translate('+f.x+'px,'+f.y+'px) scale('+f.scale+')';
 });};
 window.__timelines.vektiss.seek=t=>{seek(t);return window.__timelines.vektiss;};seek(0);
 })();</script>`;
 return html.replace('</body>',code+'</body>');
}
