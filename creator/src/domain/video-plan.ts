import { z } from 'zod';
import {voiceEngineSchema,voiceSpeedSchema} from './voice-settings.ts';
import {avatarFramingSchema} from './avatar-framing.ts';
import {screenshotStorySchema} from './screenshot-story.ts';
import {backgroundFramingSchema} from './background-framing.ts';
import {editBrandSchema} from './edit-brand.ts';
export const presenterPositions=['bottom-left','bottom-center','bottom-right','middle-left','middle-right'] as const;
export const graphicCaptureSchema=z.object({id:z.string().uuid(),title:z.string().max(2000),source_url:z.string().max(2000),caption:z.string().max(2000).optional(),context:z.string().max(4000).optional()});
// Anchors may extend outside the frame; the canvas/export crops the overflow.
export const freePlacementSchema=z.object({x:z.number().min(-2).max(3),y:z.number().min(-2).max(3),width:z.number().min(5).max(100)}).strict();
export const videoRenderStatusSchema=z.enum(['submitting','pending','processing','assembling','ready','failed','uncertain']);
export const videoRenderSchema=z.object({
 job_id:z.string().uuid(),
 status:videoRenderStatusSchema,
 submitted_at:z.string(),
 updated_at:z.string(),
 export_id:z.string().regex(/^[a-f0-9]{64}$/).optional(),
 message:z.string().max(500).nullable().optional(),
}).strict();
export type VideoRender=z.infer<typeof videoRenderSchema>;
export function renderStateFromJob(job:{id:string;status:string;message?:string|null},previous?:VideoRender):VideoRender{
 const status=previous?.status==='ready'?'ready':job.status==='completed'?'assembling':videoRenderStatusSchema.safeParse(job.status).success?job.status as VideoRender['status']:'uncertain';
 return {job_id:job.id,status,submitted_at:previous?.submitted_at??new Date().toISOString(),updated_at:new Date().toISOString(),...(previous?.export_id?{export_id:previous.export_id}:{}),...(job.message!==undefined?{message:job.message}:previous?.message!==undefined?{message:previous.message}:{})};
}
export function videoRenderProgress(render:VideoRender|undefined){
 if(!render)return null;
 const states:Record<VideoRender['status'],{percent:number;label:string}>={
  submitting:{percent:10,label:'Submitting your video'},
  pending:{percent:25,label:'Queued for creation'},
  processing:{percent:65,label:'Creating your presenter'},
  assembling:{percent:85,label:'Finishing your MP4'},
  ready:{percent:100,label:'Ready to view'},
  failed:{percent:0,label:'Needs attention'},
  uncertain:{percent:0,label:'Check render status'},
 };
 return states[render.status];
}
export const videoPlanSchema=z.object({
 setting:z.enum(['original','studio']).optional(),
 studio_background:graphicCaptureSchema.optional(),
 edit_template:z.enum(['recommend','premium-explainer','tier-list','walkthrough','hyperframes-motion','phone-mockup','paper-cutout','clean-tech','glass-cards','animated-explainer','charts-comparisons']).optional(),
 edit_brand:editBrandSchema.optional(),
 step:z.enum(['approve','presenter','visuals','review','saved']),
 approved_at:z.string().nullable(),
 presenter:z.enum(['self','avatar']),
 avatar_id:z.string().nullable(),
 avatar_name:z.string().max(200),
 voice:z.object({id:z.string().trim().min(1).max(300),name:z.string().max(300)}).optional(),
 voice_engine:voiceEngineSchema.optional(),
 voice_speed:voiceSpeedSchema.optional(),
 voice_preview_approval:z.object({voice_id:z.string().max(300),engine:voiceEngineSchema,speed:voiceSpeedSchema,text:z.string().max(1200),approved_at:z.string().datetime()}).optional(),
 avatar_engine:z.enum(['avatar_iii','avatar_iv','avatar_v']).nullable().optional(),
 avatar_preview:z.object({avatar_id:z.string(),engine:z.string(),format:z.string(),aspect:z.number().positive().max(10)}).optional(),
 format:z.enum(['portrait','landscape','square']),
 style:z.enum(['presenter','source-cutaways','captions']),
 captions:z.boolean(),
 visual_notes:z.string().max(4000),
 presenter_position:z.enum(presenterPositions).default('bottom-right'),
 presenter_size:z.number().min(15).max(90).default(28),
 presenter_placement:freePlacementSchema.optional(),
 presenter_sizing:z.literal('visible-person-v1').optional(),
	 presenter_framing:avatarFramingSchema.optional(),
	 presenter_framing_amount:z.number().int().min(30).max(100).optional(),
	 presenter_framing_position:z.number().int().min(0).max(100).optional(),
 article_capture:graphicCaptureSchema.optional(),
 background_framing:backgroundFramingSchema.optional(),
 screenshot_story:screenshotStorySchema.optional(),
 video_background:z.object({id:z.string().uuid(),source_url:z.string().max(2000)}).optional(),
 render:videoRenderSchema.optional(),
});
export type VideoPlan=z.infer<typeof videoPlanSchema>;
export const newVideoPlan=():VideoPlan=>({step:'approve',avatar_engine:null,approved_at:null,presenter:'self',avatar_id:null,avatar_name:'',format:'portrait',style:'source-cutaways',captions:true,visual_notes:'',presenter_position:'bottom-center',presenter_size:30,presenter_placement:{x:.5,y:1,width:30},presenter_sizing:'visible-person-v1',presenter_framing:'head-shoulders'});
export const planReady=(p:VideoPlan)=>Boolean(p.approved_at&&(p.presenter==='self'||p.avatar_id));
