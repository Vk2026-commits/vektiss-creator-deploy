import type {EditProposal} from './edit-templates';
/** Old timing compilers split a lead-in from its graphic. Rejoin matching scenes
 * without moving a word anchor, truncating language, or changing speech. */
export function popoutDisplayPlan(plan:EditProposal):EditProposal{
 const beats:EditProposal['beats']=[];
 for(const raw of plan.beats){
  const b={...raw,graphics:raw.graphics?{...raw.graphics,nodes:[...raw.graphics.nodes]}:undefined};
  if(b.scene==='statistic'&&b.graphics?.nodes.some(n=>/\d/.test(n.label))){
   const labels=b.graphics.nodes.map(n=>n.label).join(' ');
   b.headline=/people|participants/i.test(labels)&&/hour|\/hr/i.test(labels)?'Participation and pay':'Reported figures';
  }
  if(b.graphics?.nodes.length&&b.visual==='presenter'){b.visual='diagram';b.layout='bottom-presenter';}
  const prior=beats.at(-1);
  if(prior&&!prior.graphics?.nodes.length&&prior.headline===b.headline&&prior.lastWord+1===b.firstWord){beats[beats.length-1]={...b,firstWord:prior.firstWord};}
  else beats.push(b);
 }
 return {...plan,beats};
}
export function popoutTitle(beat:EditProposal['beats'][number]){
 // Only rearrange an already-approved CTA; never extract an unfinished transcript.
 const cta=beat.headline.match(/^comment\s+['"“]?([\w-]+)['"”]?\s+for\s+(?:a\s+)?(.+)$/i);
 return cta?{headline:`Comment ${cta[1].toUpperCase()}`,support:cta[2][0].toUpperCase()+cta[2].slice(1)}:{headline:beat.headline,support:''};
}
