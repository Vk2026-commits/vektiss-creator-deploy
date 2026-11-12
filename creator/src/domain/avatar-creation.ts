import {z} from 'zod';
import {editBrandSchema} from './edit-brand.ts';
import {videoPlanSchema} from './video-plan.ts';
import type {ContentProfile} from './strategy.ts';
export const avatarCreationSchema=z.object({
 intake_stage:z.enum(['profile','style','idea','review']).optional(),
 template:videoPlanSchema.shape.edit_template.default('tier-list'),
 brand:editBrandSchema.optional(),
 format:z.enum(['portrait','landscape','square']).default('portrait'),
 topic:z.string().max(200).default(''),angle:z.string().max(2000).default(''),
 items:z.array(z.object({label:z.string().max(45),rating:z.enum(['S','A','B','C','D','F'])})).max(10).default([]),
 approved:z.boolean().default(false),
});
export type AvatarCreation=z.infer<typeof avatarCreationSchema>;
export type AvatarIntent={id:string;profileId:string|null;creation:AvatarCreation};
export function profileIdeas(profile:ContentProfile){
 const topics=[...new Set([...profile.strategy.content_pillars,...profile.strategy.audience_interests,...profile.strategy.source_topics].filter(Boolean))];
 const safety=/safety|security|situational/i.test([profile.name,...topics].join(' '));
 const ideas=safety?[
  {title:'Rank everyday personal safety habits',labels:['Notice nearby exits','Keep distance from conflict','Stay aware of surroundings','Ignore warning signs']},
  {title:'Rank responses when someone follows you',labels:['Move toward a staffed public place','Ask for help','Head straight home','Confront the person alone']},
  {title:'Rank habits for arriving home after dark',labels:['Prepare keys before arriving','Check surroundings before exiting','Pause to scroll on your phone','Enter while distracted']},
 ]:topics.slice(0,3).map(topic=>({title:`Rank approaches to ${topic}`.slice(0,200),labels:[`Learn the basics`,`Practice on a small example`,`Get feedback`,`Skip preparation`]}));
 while(ideas.length<3)ideas.push({title:`${['What to try first','Common mistakes','Habits worth keeping'][ideas.length]}: ${topics[0]??profile.name}`.slice(0,200),labels:['Prepare first','Try a small step','Ask for feedback','Rush without a plan']});
 return ideas.map(idea=>({...idea,angle:`Share your perspective for ${profile.primary_audience}. Explain the tradeoffs; these are suggested opinions, not proven outcomes.`,items:idea.labels.map((label,index)=>({label:label.slice(0,45),rating:(['S','A','C','F'] as const)[index]}))}));
}
export function avatarBriefSource(c:AvatarCreation){return `Creator-approved original video idea: ${c.topic}\nAngle: ${c.angle}\n${c.template==='tier-list'?`Opinion-based ranking, in reveal order. Keep these exact item labels and ratings in the narration; do not invent or change rankings:\n${c.items.map((x,i)=>`${i+1}. ${x.label}: ${x.rating}`).join('\n')}`:''}\nNo reference footage is required. Do not invent evidence, statistics, quotations, personal experience or guaranteed outcomes.`;}

export function rankingScriptError(c:AvatarCreation|undefined,text:string):string|null{
 if(!c||c.template!=='tier-list')return null;
 if(!c.approved)return 'Approve your ranking idea before approving the script.';
 let cursor=0;
 for(const item of c.items){
  const pos=text.toLowerCase().indexOf(item.label.toLowerCase(),cursor);
  if(pos<0)return `Include “${item.label}” in the approved reveal order before continuing.`;
  const next=text.slice(pos+item.label.length,pos+item.label.length+100);
  if(!new RegExp(`\\b${item.rating}\\b`,'i').test(next))return `State the approved ${item.rating} rating immediately after “${item.label}”.`;
  cursor=pos+item.label.length;
 }
 return null;
}
