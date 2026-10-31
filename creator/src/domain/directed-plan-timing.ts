import type {EditProposal,EditSource} from './edit-templates.ts';

type Beat=EditProposal['beats'][number];
type Figure={value:number;lastWord:number;qualifier?:string};
import {figurePattern,numberValue,transcriptFigures} from './transcript-figures.ts';

/** Digit figures only: never infer quantities from prose or invent a number. */
function figures(text:string){
 return [...text.matchAll(figurePattern())].map(match=>numberValue(match[0])).filter(value=>value>=10);
}
function spokenFigures(beat:Beat,source:EditSource):Figure[]{
 return transcriptFigures(source).filter(f=>f.firstWord>=beat.firstWord&&f.lastWord<=beat.lastWord);
}
function supportWord(text:string,spoken:Figure[]){
 const indices=figures(text).flatMap(value=>{const found=spoken.find(item=>item.value===value);return found?[found.lastWord]:[];});
 return indices.length?Math.max(...indices):undefined;
}

/** Hold numeric headlines until the final supported figure has been spoken.
 * Unsupported figures remain the quality validator's responsibility. */
export function directedHeadlineTime(beat:Beat,source:EditSource){
 const supported=supportWord(beat.headline,spokenFigures(beat,source));
 return source.words[supported??beat.firstWord].start;
}

/** Timing-only compilation. Preserve the graphic's language, objects and order;
 * turn a long wait for its first object into a speech-grounded animated title. */
export function timeDirectedPlan(plan:EditProposal,source:EditSource):EditProposal{
 if(plan.templateId!=='popout-explainer')return plan;
 const beats=plan.beats.flatMap((beat):Beat[]=>{
  if(beat.visual==='presenter'||!beat.graphics?.nodes.length)return [beat];
  const spoken=spokenFigures(beat,source);
  const qualify=(text:string)=>text.replace(new RegExp('[$£€]?(?:'+figurePattern().source+')','g'),(match:string,offset:number)=>{
   const q=spoken.find(f=>f.value===numberValue(match.replace(/[$£€]/g,'')))?.qualifier;
   if(!q||text.slice(0,offset).toLowerCase().endsWith(q.toLowerCase()+' ')||text.slice(0,offset).toLowerCase().endsWith(q.toLowerCase()+' $'))return match;
   return q+' '+match;
  }).replace(/(\bover \d[\d,]*)\+/gi,'$1');
  let nodes=beat.graphics.nodes.map(node=>{
   node={...node,label:qualify(node.label)};
   if(node.revealWord===undefined)return node;
   const supported=supportWord(node.label,spoken);
   return supported===undefined||supported<=node.revealWord?node:{...node,revealWord:supported};
  });
  let links=beat.graphics.links;
  if(['search','document','timeline','process'].includes(beat.scene??'')&&nodes.every(n=>n.revealWord!==undefined)){
   const order=nodes.map((_,i)=>i).sort((a,b)=>nodes[a].revealWord!-nodes[b].revealWord!);
   nodes=order.map(i=>nodes[i]);links=links.map(l=>({from:order.indexOf(l.from),to:order.indexOf(l.to)}));
  }
  const timed={...beat,headline:qualify(beat.headline),graphics:{...beat.graphics,nodes,links}};
  // Missing anchors must not be guessed. Charts retain their own source timing.
  if(nodes.some(node=>node.revealWord===undefined)||beat.graphics.chart||figures(beat.headline).length)return [timed];
  const first=Math.min(...nodes.map(node=>node.revealWord!));
  if(first<=beat.firstWord||first>beat.lastWord||source.words[first].start-source.words[beat.firstWord].start<=1.25)return [timed];
  const lead:Beat={...beat,lastWord:first-1,layout:'bottom-presenter',visual:'typography',headline:beat.headline,scene:'spotlight',illustration:'',motion:'',graphics:{nodes:[],links:[]}};
  return [lead,{...timed,firstWord:first}];
 });
 return {...plan,beats};
}
