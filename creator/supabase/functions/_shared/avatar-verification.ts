import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {PublicError} from './avatar-contract.ts';
const crop=z.object({x:z.number().int().nonnegative(),y:z.number().int().nonnegative(),width:z.number().int().positive(),height:z.number().int().positive()});
const receipt=z.object({test_id:z.string().uuid(),user_id:z.string().uuid(),verification_version:z.literal(1),crop,source_width:z.number().int().min(32).max(2048),source_height:z.number().int().min(32).max(2048)});
export async function avatarVerification(db:SupabaseClient,user:string,avatar:any,engine:string,aspect:string){
 const {data,error}=await db.from('creator_avatar_verifications').select('test_id,crop,thumbnail_url,source_width,source_height,visual_approved_at').eq('user_id',user).eq('connection_id',avatar.connection_id).eq('avatar_id',avatar.id).eq('engine',engine).eq('aspect_ratio',aspect).eq('verification_version',1).maybeSingle();
 if(error)throw new PublicError('VERIFICATION','Could not check avatar readiness. Retry before generating.',503);
 return data&&data.visual_approved_at&&data.thumbnail_url===avatar.thumbnail_url?data:null;
}
export async function verifySavedAvatar(db:SupabaseClient,user:string,testId:string,authorization:string,origin:string,visualApproved:boolean=false){
 if(visualApproved!==true)throw new PublicError('VISUAL_REVIEW_REQUIRED','Watch the saved test and confirm that only the person remains before approving this look.',409);
 const {data:job,error}=await db.from('creator_presenter_tests').select('*').eq('id',testId).eq('user_id',user).single();
 if(error||!job||job.status!=='completed'||job.snapshot?.scope!=='test')throw new PublicError('TEST_REQUIRED','Complete a short avatar test first.',409);
 const {data:avatar}=await db.from('avatar_profiles').select('*').eq('user_id',user).eq('connection_id',job.connection_id).eq('provider_avatar_id',job.snapshot.avatar_id).eq('status','ready').maybeSingle();
 if(!avatar||!('look_thumbnail_url' in job.snapshot)||job.snapshot.look_thumbnail_url!==avatar.thumbnail_url)throw new PublicError('LOOK_CHANGED','This test belongs to an older look. Review a new short test before full generation.',409);
 const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password)throw Error('INVALID_VERIFIER');
 const response=await fetch(`${url.origin}/api/local-capture/avatar-verification/${testId}`,{headers:{Authorization:authorization,'X-Creator-Capture':'1'},redirect:'error',signal:AbortSignal.timeout(100000)});
 if(!response.ok){const body=await response.json().catch(()=>null);throw new PublicError('BACKGROUND_CHECK',typeof body?.error==='string'?body.error:'Background check unavailable. Retry verification; no new paid test is needed.',409);}
 const verified=receipt.parse(await response.json());
 if(verified.user_id!==user||verified.test_id!==testId)throw Error('INVALID_VERIFICATION_OWNER');
 if(verified.crop.x+verified.crop.width>verified.source_width||verified.crop.y+verified.crop.height>verified.source_height)throw Error('INVALID_VERIFICATION_CROP');
 const saved=await db.from('creator_avatar_verifications').upsert({user_id:user,connection_id:job.connection_id,avatar_id:avatar.id,engine:job.snapshot.avatar_engine??'avatar_iv',aspect_ratio:job.snapshot.aspect_ratio,thumbnail_url:avatar.thumbnail_url,test_id:testId,verification_version:1,crop:verified.crop,source_width:verified.source_width,source_height:verified.source_height,verified_at:new Date().toISOString(),visual_approved_at:new Date().toISOString()},{onConflict:'user_id,connection_id,avatar_id,engine,aspect_ratio'});
 if(saved.error)throw new PublicError('VERIFICATION','Could not save the check. Retry verification; no new paid test is needed.',503);
 return {verified:true,test_id:testId,crop:verified.crop};
}
