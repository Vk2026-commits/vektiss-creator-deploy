import { z } from 'zod';
export const presenterPositions=['bottom-left','bottom-center','bottom-right','middle-left','middle-right'] as const;
export const graphicCaptureSchema=z.object({id:z.string().uuid(),title:z.string().max(2000),source_url:z.string().max(2000)});
// Anchors may extend outside the frame; the canvas/export crops the overflow.
export const freePlacementSchema=z.object({x:z.number().min(-2).max(3),y:z.number().min(-2).max(3),width:z.number().min(5).max(100)}).strict();
export const videoPlanSchema=z.object({
 step:z.enum(['approve','presenter','visuals','review','saved']),
 approved_at:z.string().nullable(),
 presenter:z.enum(['self','avatar']),
 avatar_id:z.string().nullable(),
 avatar_name:z.string().max(200),
 voice:z.object({id:z.string().trim().min(1).max(300),name:z.string().max(300)}).optional(),
 voice_engine:z.enum(['auto','fish']).optional(),
 format:z.enum(['portrait','landscape','square']),
 style:z.enum(['presenter','source-cutaways','captions']),
 captions:z.boolean(),
 visual_notes:z.string().max(4000),
 presenter_position:z.enum(presenterPositions).default('bottom-right'),
 presenter_size:z.number().min(15).max(90).default(28),
 presenter_placement:freePlacementSchema.optional(),
 article_capture:graphicCaptureSchema.optional(),
 video_background:z.object({id:z.string().uuid(),source_url:z.string().max(2000)}).optional(),
});
export type VideoPlan=z.infer<typeof videoPlanSchema>;
export const newVideoPlan=():VideoPlan=>({step:'approve',approved_at:null,presenter:'self',avatar_id:null,avatar_name:'',format:'portrait',style:'source-cutaways',captions:true,visual_notes:'',presenter_position:'bottom-center',presenter_size:70,presenter_placement:{x:.5,y:1,width:70}});
export const planReady=(p:VideoPlan)=>Boolean(p.approved_at&&(p.presenter==='self'||p.avatar_id));
