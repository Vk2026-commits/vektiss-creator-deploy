import type {EditProposal,EditSource} from './edit-templates.ts';
// Conservative checks, not a substitute for editorial review. Never silently rewrite claims.
export function assertDirectedPlanQuality(plan:EditProposal,source:EditSource){
 if(plan.templateId!=='popout-explainer')return;
 const figures=(text:string)=>text.replace(/(\d)[,\s]+(?=\d{3}(?:\D|$))/g,'$1').match(/\d+(?:\.\d+)?/g)?.filter(n=>Number(n)>=10)??[];
 const supported=new Set(figures(source.words.map(w=>w.text).join(' ')));
 for(const beat of plan.beats){
  const text=[beat.headline,...(beat.graphics?.nodes??[]).map(n=>n.label)].join(' ');
  if(figures(text).some(n=>!supported.has(n)))throw Error('EDIT_UNSUPPORTED_FIGURE');
  const end=source.words[beat.lastWord+1]?.start??source.duration;
  const duration=end-source.words[beat.firstWord].start;
  if(beat.visual!=='presenter'&&duration>12)throw Error('EDIT_UNDERDIRECTED_SCENE');
 }
}
