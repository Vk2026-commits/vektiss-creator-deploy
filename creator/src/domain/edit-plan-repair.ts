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
 // A source attribution may be reused later as context. If its anchor points
 // to an earlier spoken mention, reveal it at this scene's start only when the
 // actual transcript verifies every meaningful label word. Never move figures.
 for(const beat of plan.beats){
  for(const node of beat.graphics?.nodes??[]){
   if(node.asset!=='document'||! /\breports?\b/i.test(node.label)||node.revealWord===undefined||node.revealWord>=beat.firstWord||/\d/.test(node.label))continue;
   const tokens=node.label.toLowerCase().match(/[a-z]+/g)?.filter(w=>!['a','an','the','report','reports','according','to'].includes(w))??[];
   const spoken=source.words.slice(Math.max(0,node.revealWord-2),Math.min(beat.firstWord,node.revealWord+6)).map(w=>w.text.toLowerCase().replace(/[^a-z]/g,''));
   if(tokens.length>=2&&tokens.every(w=>spoken.includes(w)))node.revealWord=beat.firstWord;
  }
 }
 // Legacy candidates sometimes mark a populated graphic as presenter-only.
 // Normalize before timing so numeric word anchors still receive validation.
 if(template==='popout-explainer')for(const beat of plan.beats){
  if(beat.visual==='presenter'&&beat.graphics?.nodes.length){beat.visual='diagram';beat.layout='bottom-presenter';}
 }
 // Preserve a spoken negation rather than reversing it into a directional claim.
 for(const beat of plan.beats){
  const speech=source.words.slice(beat.firstWord,beat.lastWord+1).map(w=>w.text).join(' ').toLowerCase();
  for(const node of beat.graphics?.nodes??[]){
   const match=node.label.match(/^Lower ([a-z ]+)$/i);
   if(match){
    const subject=match[1].toLowerCase();
    const higher=speech.indexOf('higher '+subject);
    if(higher>=0&&/\b(?:not|doesn't|don't|isn't|aren't)\b/.test(speech.slice(Math.max(0,higher-90),higher))&&!speech.includes('lower '+subject))node.label='Not higher '+match[1];
   }
  }
 }
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
