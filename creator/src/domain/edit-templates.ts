import {z} from 'zod';
import {editorialAssetIds} from './editorial-assets.ts';
import {editAspectRatio} from './edit-format.ts';

export const editTemplateId=z.enum(['premium-explainer','tier-list','walkthrough','hyperframes-motion','phone-mockup','paper-cutout','clean-tech','glass-cards','popout-explainer','animated-explainer','charts-comparisons']);
export const editTemplates=[
 {id:'popout-explainer',name:'Pop-out Explainer',description:'A presenter that extends beyond the frame, with connected graphics and editorial cards.',direction:'Alternate source-led diagrams, document cards and occasional full presenter moments. Use 2–4 short nodes with explicit links for processes. Keep headlines concise. The presenter stays in an aligned rounded room panel with their head extending above it. Never invent facts or numerical claims.'},
 {id:'animated-explainer',name:'Animated Explainer',description:'Ideas build into connected diagrams while the presenter stays visible.',direction:'Use process, network and timeline diagrams with 2–4 short nodes and explicit links that explain the actual speech. Reveal each node when its idea is spoken, then draw its connections. Keep presenter breathing room. No invented relationships or data.'},
 {id:'charts-comparisons',name:'Charts & Comparisons',description:'Clear alternatives and source-backed numerical comparisons.',direction:'Use concise comparison panels. Only add graphics.chart when the transcript explicitly states numeric digits with the same unit for all items. Each item needs sourceWord pointing to its exact number token. Unit must occur in the beat. Never invent figures, trends or proportions. Otherwise use equal-sized qualitative panels with nodes and no chart. Include nodes matching chart labels for editing compatibility.'},
 {id:'glass-cards',name:'Glass Cards',description:'Full-screen presenter with dark translucent cards and crisp brand accents.',direction:'Use one concise glass card at a time over the lower torso, keeping the face and caption area clear. Alternate presenter-only beats with cards. Each card has one short headline and at most two short supporting labels. Prefer 4–8 second readable holds, not constant effects. Use only claims supported by the source.'},
 {id:'clean-tech',name:'Clean Tech Explainer',description:'Official logo suggestions, clear cards, and a presenter below the explanation.',direction:'Use clear short headlines and comparisons. Real logos are retrieved separately from official sites and require user approval; never invent logo artwork or asset URLs. Keep the presenter below the explanation; use presenter-only beats for breathing room. Use no more than two labels per graphic.'},
 {id:'phone-mockup',name:'Phone Mockup',description:'Your footage inside an animated phone with clear editorial callouts.',direction:'Show the original recording inside a phone frame. Use concise source-led headlines and a few short callouts. Never fabricate a screen recording, app interface, message, or testimonial.'},
 {id:'paper-cutout',name:'Paper Cutout',description:'A separated presenter with a paper outline, layered headlines, and tactile cards.',direction:'The renderer separates the presenter from the original background. Use concise source-led headlines and restrained paper cards. Keep room for the presenter. Do not invent images, claims, or numbers.'},
 {id:'hyperframes-motion',name:'HyperFrames Motion',description:'Animated statement cards, bold comparisons, and word-timed reveals alongside your presenter.',direction:'Use source-led headlines, concise animated cards, comparisons, statistics, and spotlight statements. Preserve the original presenter and speech. Prefer 2–3 short labels per scene, never invent numbers or claims. These are HTML motion scenes rendered with HyperFrames, not stock footage.'},
 {id:'premium-explainer',name:'Premium Explainer',description:'Topic-specific diagrams, purposeful motion, and a bottom presenter.',direction:'Choose an explanatory relationship from the actual speech. Prefer white/navy/blue, original diagrams, and a bottom presenter. Head-above-frame requires a verified matte. Vary layouts only when the idea benefits.'},
 {id:'tier-list',name:'Tier List',description:'Full-screen presenter, animated options, and a lower ranking board.',direction:'Keep the presenter full screen with a lower board. Use a compact dark S–F tier board over the lower torso, keeping the face clear. Add each item once, with revealWord anchored to its spoken ranking; previously ranked items remain visible across beats. Never assign an unspoken tier. Reveal S last only when the source order permits it without cutting speech. Never invent or change ratings.'},
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
  nodes:z.array(z.object({label:z.string().min(1).max(45),asset:z.enum(editorialAssetIds).optional(),shape:z.enum(['box','circle']),x:z.number().min(10).max(90),y:z.number().min(15).max(85),tier:z.enum(['S','A','B','C','D','E','F']).optional(),revealWord:z.number().int().nonnegative().optional()}).strict()).max(6),
  chart:z.object({unit:z.string().max(30),items:z.array(z.object({label:z.string().min(1).max(45),value:z.number().finite().min(0).max(1e15),sourceWord:z.number().int().nonnegative()}).strict()).min(2).max(4)}).strict().optional(),
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
  if(templateId==='charts-comparisons'&&(b.graphics?.nodes.length??0)>4)throw Error('EDIT_SCENE_DENSITY');
  if(b.graphics?.chart){
   if(templateId!=='charts-comparisons')throw Error('EDIT_CHART_TEMPLATE');
   const chart=b.graphics.chart;
   const spoken=source.words.slice(b.firstWord,b.lastWord+1).map(w=>w.text).join(' ').toLowerCase();
   if(chart.unit&&!spoken.includes(chart.unit.toLowerCase()))throw Error('EDIT_CHART_UNIT');
   for(const item of chart.items){
    if(item.sourceWord<b.firstWord||item.sourceWord>b.lastWord)throw Error('EDIT_CHART_SOURCE');
    const token=source.words[item.sourceWord].text.replace(/[, $£€%]/g,'').replace(/[.!?;:]$/,'');
    if(!/^\d+(?:\.\d+)?$/.test(token)||Number(token)!==item.value)throw Error('EDIT_CHART_SOURCE');
   }
  }
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
