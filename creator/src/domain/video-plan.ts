import { z } from 'zod';
import {screenshotStorySchema} from './screenshot-story.ts';
import {backgroundFramingSchema} from './background-framing.ts';
import {voiceEngineSchema,voiceSpeedSchema} from './voice-settings.ts';
export const presenterPositions=['bottom-left','bottom-center','bottom-right','middle-left','middle-right'] as const;
export const graphicCaptureSchema=z.object({id:z.string().uuid(),title:z.string().max(2000),source_url:z.string().max(2000),caption:z.string().max(2000).optional(),context:z.string().max(4000).optional()});
// Anchors may extend outside the frame; the canvas/export crops the overflow.
export const freePlacementSchema=z.object({x:z.number().min(-2).max(3),y:z.number().min(-2).max(3),width:z.number().min(5).max(100)}).strict();
export const videoPlanSchema=z.object({
 step:z.enum(['approve','presenter','visuals','review','saved']),
 approved_at:z.string().nullable(),
 presenter:z.enum(['self','avatar']),
 avatar_id:z.string().nullable(),
 avatar_name:z.string().max(200),
 voice:z.object({id:z.string().trim().min(1).max(300),name:z.string().max(300)}).optional(),
 voice_engine:voiceEngineSchema.optional(),
 voice_speed:voiceSpeedSchema.optional(),
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
 article_capture:graphicCaptureSchema.optional(),
 background_framing:backgroundFramingSchema.optional(),
 screenshot_story:screenshotStorySchema.optional(),
 video_background:z.object({id:z.string().uuid(),source_url:z.string().max(2000)}).optional(),
});
export type VideoPlan=z.infer<typeof videoPlanSchema>;
export const newVideoPlan=():VideoPlan=>({step:'approve',avatar_engine:null,approved_at:null,presenter:'self',avatar_id:null,avatar_name:'',format:'portrait',style:'source-cutaways',captions:true,visual_notes:'',presenter_position:'bottom-center',presenter_size:35,presenter_placement:{x:.5,y:1,width:35},presenter_sizing:'visible-person-v1'});
export const planReady=(p:VideoPlan)=>Boolean(p.approved_at&&(p.presenter==='self'||p.avatar_id));

export function sameRenderValue(left:unknown,right:unknown):boolean{
 if(Object.is(left,right))return true;
 if(!left||!right||typeof left!=='object'||typeof right!=='object')return false;
 if(Array.isArray(left)||Array.isArray(right))return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((value,index)=>sameRenderValue(value,right[index]));
 const leftRecord=left as Record<string,unknown>,rightRecord=right as Record<string,unknown>;
 const leftKeys=Object.keys(leftRecord),rightKeys=Object.keys(rightRecord);
 return leftKeys.length===rightKeys.length&&leftKeys.every(key=>Object.prototype.hasOwnProperty.call(rightRecord,key)&&sameRenderValue(leftRecord[key],rightRecord[key]));
}

// Render components may report the same derived preview more than once while
// polling a saved job. Preserve all plan fields and retain the existing object
// when nothing actually changed so callers do not trigger another save cycle.
export function mergeRenderPlan(current:VideoPlan,incoming:VideoPlan):VideoPlan{
 const next={...current,...incoming};
 return sameRenderValue(current,next)?current:next;
}
