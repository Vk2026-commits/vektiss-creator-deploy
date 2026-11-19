import {z} from 'zod';
import {editProposalSchema,validateEditProposal,type EditSource} from './edit-templates';
import {rankingDefault} from './ranking-default';

// Compile only approved labels that occur exactly once with their spoken tier.
// No inferred ratings, fuzzy matches, new copy, or provider requests.
export function approvedRankingPlan(raw:unknown,source:EditSource){
 const project=z.object({title:z.string().min(1).max(100),brief:z.object({avatar_creation:z.object({approved:z.literal(true),template:z.literal('tier-list'),items:z.array(z.object({label:z.string().min(1).max(45),rating:z.enum(['S','A','B','C','D','E','F'])})).min(1).max(6)})})}).parse(raw);
 const tokens=source.words.flatMap((w,index)=>(w.text.toLowerCase().match(/[a-z0-9]+/g)??[]).map(text=>({text,index})));
 let previous=-1;
 const nodes=project.brief.avatar_creation.items.map(item=>{
  const label=item.label.toLowerCase().match(/[a-z0-9]+/g)??[];
  const hits=tokens.flatMap((t,i)=>label.length&&label.every((s,j)=>tokens[i+j]?.text===s)&&tokens[i+label.length]?.text===item.rating.toLowerCase()&&tokens[i+label.length+1]?.text==='tier'?[{introducedWord:t.index,revealWord:tokens[i+label.length].index}]:[]);
  if(hits.length!==1||hits[0].introducedWord<=previous)throw Error('Approved rankings do not match the saved speech unambiguously.');
  previous=hits[0].revealWord;
  return {label:item.label,tier:item.rating,shape:'box' as const,x:50,y:50,...hits[0]};
 });
 return validateEditProposal(editProposalSchema.parse({version:1,rendererVersion:2,rankingStyle:rankingDefault.id,templateId:'tier-list',sourceRevision:source.revision,beats:[{firstWord:0,lastWord:source.words.length-1,layout:'presenter',visual:'tier-board',headline:project.title,purpose:'Reveal the approved rankings in spoken order; preserve the complete recording and closing.',illustration:'',motion:'Creator Ranking default timed reveals',graphics:{nodes,links:[]}}]}),source,'tier-list');
}
