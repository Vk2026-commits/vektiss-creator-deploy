import {z} from 'zod';
import {editAspectRatio} from './edit-format.ts';

export const editTemplateId=z.enum(['premium-explainer','tier-list','walkthrough','hyperframes-motion']);
export const editTemplates=[
 {id:'hyperframes-motion',name:'HyperFrames Motion',description:'Animated statement cards, bold comparisons, and word-timed reveals alongside your presenter.',direction:'Use source-led headlines, concise animated cards, comparisons, statistics, and spotlight statements. Preserve the original presenter and speech. Prefer 2–3 short labels per scene, never invent numbers or claims. These are HTML motion scenes rendered with HyperFrames, not stock footage.'},
 {id:'premium-explainer',name:'Premium Explainer',description:'Topic-specific diagrams, purposeful motion, and a bottom presenter.',direction:'Choose an explanatory relationship from the actual speech. Prefer white/navy/blue, original diagrams, and a bottom presenter. Head-above-frame requires a verified matte. Vary layouts only when the idea benefits.'},
 {id:'tier-list',name:'Tier List',description:'Full-screen presenter, animated options, and a lower ranking board.',direction:'Keep the presenter full screen with a lower board. Introduce each option above the head, then move it into its stated tier. Reveal S last only when the source order permits it without cutting speech. Never invent or change ratings.'},
 {id:'walkthrough',name:'Walkthrough',description:'Clear screen actions, focused highlights, and restrained graphics.',direction:'Preserve important screen actions and demonstrations. Use supplied screen evidence; do not fabricate interfaces. Prefer a clear screen crop and restrained highlights over decorative graphics.'},
] as const;

const word=z.object({start:z.number().nonnegative(),end:z.number().positive(),text:z.string().min(1).max(120)}).strict();
export const editSourceSchema=z.object({
 kind:z.enum(['avatar','upload']),assetId:z.string().uuid(),revision:z.string().min(1).max(200),
 duration:z.number().positive().max(1800),words:z.array(word).min(1).max(12000),
}).strict().superRefine((s,ctx)=>{
 s.words.forEach((w,i)=>{if(w.end<=w.start||w.end>s.duration||i>0&&w.start<s.words[i-1].end)ctx.addIssue({code:'custom',message:'Transcript words must have ordered, nonoverlapping times within the actual media.',path:['words',i]});});
});
export type EditSource=z.infer<typeof editSourceSchema>;
const beat=z.object({
 scene:z.enum(['process','timeline','comparison','network','statistic','document','spotlight']).optional(),
 firstWord:z.number().int().nonnegative(),lastWord:z.number().int().nonnegative(),
 layout:z.enum(['presenter','bottom-presenter','split','full-graphic']),
 visual:z.enum(['presenter','diagram','comparison','steps','typography','tier-board','screen-focus']),
 headline:z.string().max(100),purpose:z.string().min(1).max(600),
 illustration:z.string().max(1200),motion:z.string().max(600),
 graphics:z.object({
  nodes:z.array(z.object({label:z.string().min(1).max(45),shape:z.enum(['box','circle']),x:z.number().min(10).max(90),y:z.number().min(15).max(85),tier:z.enum(['S','A','B','C','D']).optional(),revealWord:z.number().int().nonnegative().optional()}).strict()).max(6),
  links:z.array(z.object({from:z.number().int().min(0).max(5),to:z.number().int().min(0).max(5)}).strict()).max(8),
 }).strict().optional(),
}).strict();
export const editProposalSchema=z.object({
 aspectRatio:editAspectRatio.optional(),
 rendererVersion:z.literal(2).optional(),
 version:z.literal(1),templateId:editTemplateId,sourceRevision:z.string().min(1).max(200),
 beats:z.array(beat).min(1).max(100),
}).strict();
export type EditProposal=z.infer<typeof editProposalSchema>;

// The model chooses visual meaning, not media paths, executable code, or timing.
// Word anchors are resolved only against the server's owned source transcript.
export function validateEditProposal(raw:unknown,source:EditSource,templateId:z.infer<typeof editTemplateId>):EditProposal {
 editSourceSchema.parse(source);
 const plan=editProposalSchema.parse(raw);
 if(plan.aspectRatio==='16:9'&&plan.rendererVersion!==2)throw Error('EDIT_FORMAT_VERSION');
 if(plan.templateId!==templateId||plan.sourceRevision!==source.revision)throw Error('EDIT_SOURCE_CHANGED');
 let next=0;
 for(const b of plan.beats){
  if(b.firstWord!==next||b.lastWord<b.firstWord||b.lastWord>=source.words.length)throw Error('EDIT_SPEECH_COVERAGE');
  if(templateId==='walkthrough'&&b.visual==='tier-board'||templateId!=='tier-list'&&b.visual==='tier-board')throw Error('EDIT_TEMPLATE_MISMATCH');
  if(b.graphics?.links.some(l=>l.from>=b.graphics!.nodes.length||l.to>=b.graphics!.nodes.length))throw Error('EDIT_GRAPHIC_LINK');
  if(b.graphics?.nodes.some(n=>n.revealWord!==undefined&&(n.revealWord<b.firstWord||n.revealWord>b.lastWord)))throw Error('EDIT_REVEAL_WORD');
  if(plan.rendererVersion===2&&b.graphics&&((b.scene==='statistic'&&b.graphics.nodes.length>3)||((b.scene==='comparison'||b.scene==='document')&&b.graphics.nodes.length>4)))throw Error('EDIT_SCENE_DENSITY');
  next=b.lastWord+1;
 }
 if(next!==source.words.length)throw Error('EDIT_SPEECH_COVERAGE');
 return plan;
}

export function editStoryboard(plan:EditProposal,source:EditSource){
 validateEditProposal(plan,source,plan.templateId);
 return plan.beats.map((b,i)=>({...b,
  start:i===0?0:source.words[b.firstWord].start,
  end:i===plan.beats.length-1?source.duration:source.words[plan.beats[i+1].firstWord].start,
  spokenText:source.words.slice(b.firstWord,b.lastWord+1).map(w=>w.text).join(' '),
 }));
}
