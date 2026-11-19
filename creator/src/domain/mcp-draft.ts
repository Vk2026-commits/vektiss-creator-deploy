import {z} from 'zod';
import {scriptSchema,type Script,type ScriptInput} from './scripts';
import {emptyBrief} from './script-brief';
import {avatarCreationSchema} from './avatar-creation';
import {newVideoPlan,videoPlanSchema} from './video-plan';
import {finishedVersion,revisedPlan} from './video-versions';
import {editBrandSchema} from './edit-brand';
import {languageLevelSchema} from './language-level';
export const mcpDraftPatch=z.object({
 title:z.string().trim().min(1).max(200).optional(),hook:z.string().max(2000).optional(),body:z.string().max(15000).optional(),cta:z.string().max(2000).optional(),
 topic:z.string().max(200).optional(),angle:z.string().max(2000).optional(),items:avatarCreationSchema.shape.items.optional(),
 template:videoPlanSchema.shape.edit_template.optional(),format:videoPlanSchema.shape.format.optional(),brand:editBrandSchema.optional(),language_level:languageLevelSchema.optional(),
 avatar_id:z.string().uuid().optional(),voice:videoPlanSchema.shape.voice.optional(),avatar_engine:videoPlanSchema.shape.avatar_engine.optional(),
}).strict();
export type McpDraftPatch=z.infer<typeof mcpDraftPatch>;
export function prepareMcpDraft(previous:ScriptInput|undefined,patch:McpDraftPatch,profileId:string,avatarName?:string):ScriptInput{
 if(previous&&finishedVersion(previous as Script))throw Error('Finished videos cannot be changed. Open Creator to make another version.');
 const p=mcpDraftPatch.parse(patch);
 const input:ScriptInput=previous?structuredClone(previous):{content_profile_id:profileId,title:p.title??p.topic??'Untitled video',hook:'',body:'',cta:'',brief:{...emptyBrief(),avatar_creation:avatarCreationSchema.parse({}),template_workflow:true}};
 if(input.brief.production?.render)throw Error('This project has a render. Open Creator to revise it safely.');
 for(const key of ['title','hook','body','cta'] as const)if(p[key]!==undefined)input[key]=p[key]!;
 if(p.language_level)input.brief.language_level=p.language_level;
 if((p.topic!==undefined||p.angle!==undefined||p.items!==undefined)&&!input.brief.avatar_creation)throw Error('Ranking ideas belong to Studio avatar projects.');
 if(input.brief.avatar_creation){
  const c=input.brief.avatar_creation;
  input.brief.avatar_creation={...c,...(p.topic!==undefined?{topic:p.topic}:{}),...(p.angle!==undefined?{angle:p.angle}:{}),...(p.items?{items:p.items}:{}),...(p.template?{template:p.template}:{}),...(p.format?{format:p.format}:{}),...(p.brand?{brand:p.brand}:{}),approved:false,intake_stage:'review'};
 }
 const plan=revisedPlan(input.brief.production)??{...newVideoPlan(),presenter:'avatar' as const};
 input.brief.production={...plan,...(p.template?{edit_template:p.template}:{}),...(p.format?{format:p.format}:{}),...(p.brand?{edit_brand:p.brand}:{}),...(p.avatar_id?{avatar_id:p.avatar_id,avatar_name:avatarName??'',voice:undefined,avatar_engine:null}:{}),...(p.voice?{voice:p.voice}:{}),...(p.avatar_engine!==undefined?{avatar_engine:p.avatar_engine}:{}),approved_at:null,step:'approve'};
 if(input.brief.avatar_creation){const c=input.brief.avatar_creation;input.brief.production.edit_template=c.template;input.brief.production.format=c.format;input.brief.production.setting=input.brief.production.setting??'original';}
 input.brief.stage='review';input.brief.mcp_review_pending=true;
 return scriptSchema.parse(input);
}
export function mcpProjectLink(origin:string,id:string){const u=new URL('/',origin);u.searchParams.set('project',id);return u.href;}
