import {timeDirectedPlan} from './directed-plan-timing.ts';
import {assertDirectedPlanQuality} from './edit-plan-quality.ts';
import {editProposalSchema,validateEditProposal,type EditSource,type EditProposal} from './edit-templates.ts';
import {normalizeEditResponse} from './edit-response-format.ts';

export function editPlanDiagnostic(error:unknown){
 const allowed=['EDIT_UNSUPPORTED_FIGURE','EDIT_UNDERDIRECTED_SCENE','EDIT_FORMAT_VERSION','EDIT_SOURCE_CHANGED','EDIT_SPEECH_COVERAGE','EDIT_TEMPLATE_MISMATCH','EDIT_GRAPHIC_LINK','EDIT_REVEAL_WORD','EDIT_SCENE_DENSITY'];
 return error instanceof Error&&allowed.includes(error.message)?error.message:'EDIT_PLAN_SCHEMA';
}

// Repair mechanical metadata only. Never reorder scenes, invent text, or drop speech.
export function repairEditPlan(raw:unknown,source:EditSource,template:EditProposal['templateId']){
 const plan=editProposalSchema.parse(normalizeEditResponse(raw));
 if(plan.sourceRevision!==source.revision||plan.templateId!==template)throw Error('EDIT_SOURCE_CHANGED');
 const starts=plan.beats.map((b,i)=>i===0?0:b.firstWord);
 if(!starts.length||starts.some((s,i)=>s>=source.words.length||i>0&&s<=starts[i-1]))throw Error('EDIT_SPEECH_COVERAGE');
 // Keep every explicit word anchor and the scene order. Adjust only a shared
 // boundary when adjacent scenes' anchors leave an unambiguous valid interval.
 if(template==='popout-explainer'){
  for(let i=1;i<starts.length;i++){
   const prior=plan.beats[i-1].graphics?.nodes.flatMap(n=>n.revealWord===undefined?[]:[n.revealWord])??[];
   const current=plan.beats[i].graphics?.nodes.flatMap(n=>n.revealWord===undefined?[]:[n.revealWord])??[];
   const lower=Math.max(starts[i-1]+1,...prior.map(w=>w+1));
   const upper=Math.min(source.words.length-1,...current);
   if(lower>upper)throw Error('EDIT_REVEAL_WORD');
   starts[i]=Math.max(lower,Math.min(upper,starts[i]));
  }
 }
 const repaired={...plan,beats:plan.beats.map((beat,i)=>{
  const firstWord=starts[i],lastWord=(starts[i+1]??source.words.length)-1;
  const b={...beat,firstWord,lastWord};
  if(b.visual==='tier-board'&&template!=='tier-list'){
   // A tierless board is a mislabeled diagram. Preserve its content and timing.
   // Actual rankings require review; never silently discard their ratings.
   if(b.graphics?.nodes.some(n=>n.tier!==undefined))throw Error('EDIT_TEMPLATE_MISMATCH');
   b.visual='diagram';
  }
  // Empty graphic instructions have nothing to draw. Keep their existing title
  // as typography rather than rejecting the entire recorded video at export.
  if(b.visual!=='presenter'&&!b.graphics?.nodes.length&&!b.graphics?.chart){
   b.visual=b.headline.trim()?'typography':'presenter';
   b.scene='spotlight';
   if(b.visual==='presenter')b.layout='presenter';
  }
  if(b.graphics){
   b.graphics={nodes:b.graphics.nodes.map(n=>{
    const copy={...n};
    if(copy.revealWord!==undefined&&(copy.revealWord<firstWord||copy.revealWord>lastWord)){
     if(template==='popout-explainer')throw Error('EDIT_REVEAL_WORD');
     delete copy.revealWord;
    }
    return copy;
   }),links:b.graphics.links.filter(l=>l.from<b.graphics!.nodes.length&&l.to<b.graphics!.nodes.length)};
   // Preserve every label by using a layout which supports its actual node count.
   if((b.scene==='statistic'&&b.graphics.nodes.length>3)||((b.scene==='comparison'||b.scene==='document')&&b.graphics.nodes.length>4))b.scene='network';
  }
  return b;
 })};
 const validated=validateEditProposal(timeDirectedPlan(repaired,source),source,template);
 assertDirectedPlanQuality(validated,source);
 return validated;
}
