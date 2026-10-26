import type {Script,ScriptInput} from './scripts';
import type {VideoPlan} from './video-plan';
export function revisedPlan(plan:VideoPlan|undefined){
 if(!plan)return undefined;
 const next=structuredClone(plan);delete next.render;delete next.voice_preview_approval;
 next.approved_at=null;next.step='approve';return next;
}
export const projectId=(s:Script)=>s.project_id??s.id;
export const versionNumber=(s:Script)=>s.version_number??1;
export const finishedVersion=(s:Script)=>Boolean(s.finalized_at||s.brief.production?.render?.status==='ready'&&s.brief.production.render.export_id);
export function projectItems(items:Script[],current:Script|null){
 const groups=new Map<string,Script>();
 for(const item of items){const id=projectId(item),prior=groups.get(id);if(!prior||versionNumber(item)>versionNumber(prior))groups.set(id,item);}
 if(current)groups.set(projectId(current),current);
 return [...groups.values()];
}
export function versionDraft(source:Script):ScriptInput{
 const copy=structuredClone(source),plan=copy.brief.production;
 if(!plan||!finishedVersion(source))throw Error('Choose a finished video.');
 delete plan.render;delete plan.voice_preview_approval;plan.step='visuals';
 return copy;
}
// Only layout/background changes can reuse paid speech. Unknown production fields
// remain in this identity, so new speech controls fail closed until classified.
export function speechIdentity(s:ScriptInput){
 const p={...s.brief.production} as Record<string,unknown>;
 for(const key of ['step','approved_at','render','voice_preview_approval','avatar_preview','article_capture','video_background','background_framing','presenter_position','presenter_size','presenter_placement','presenter_sizing','presenter_framing','presenter_framing_amount','presenter_framing_position','visual_notes','captions','style'])delete p[key];
 p.voice_engine??='auto';p.voice_speed??=1;
 delete p.edit_template;delete p.edit_brand;delete p.studio_background;
 // Only original-setting footage differs from a reusable transparent cutout.
 p.setting=p.setting==='original'?'original':'cutout';
 return JSON.stringify({hook:s.hook,body:s.body,cta:s.cta,profile:s.content_profile_id,settings:Object.fromEntries(Object.entries(p).sort(([a],[b])=>a.localeCompare(b)))});
}
export function reusablePresenter(parent:Script|undefined,draft:ScriptInput){
 return parent&&finishedVersion(parent)&&speechIdentity(parent)===speechIdentity(draft)?parent.brief.production?.render?.job_id:undefined;
}
export function invalidateVoiceApproval(previous:ScriptInput,next:ScriptInput):ScriptInput{
 if(!next.brief.production?.voice_preview_approval||speechIdentity(previous)===speechIdentity(next))return next;
 const plan={...next.brief.production};delete plan.voice_preview_approval;
 return {...next,brief:{...next.brief,production:plan}};
}
