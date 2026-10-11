import type {SupabaseClient} from '@supabase/supabase-js';
import {PublicError} from './avatar-contract.ts';

type TestAspect='9:16'|'16:9'|'1:1';
type VerificationFrame={crop:{x:number;y:number;width:number;height:number};source_width:number;source_height:number};

// HeyGen test renders are explicitly requested at 720p. The manual review happens
// in the authenticated product UI, while the eventual compositor separately
// validates the VP9 alpha channel before it assembles a finished video.
export function manualVerificationFrame(aspect:unknown):VerificationFrame{
 switch(aspect as TestAspect){
  case '9:16':return {crop:{x:0,y:0,width:720,height:1280},source_width:720,source_height:1280};
  case '16:9':return {crop:{x:0,y:0,width:1280,height:720},source_width:1280,source_height:720};
  case '1:1':return {crop:{x:0,y:0,width:720,height:720},source_width:720,source_height:720};
  default:throw new PublicError('TEST_FORMAT','This saved test has an unsupported video shape. Create a new short test before continuing.',409);
 }
}

export async function avatarVerification(db:SupabaseClient,user:string,avatar:any,engine:string,aspect:string,reuseKnownAvatar=false){
 let query:any=db.from('creator_avatar_verifications').select('test_id,crop,thumbnail_url,source_width,source_height,visual_approved_at').eq('user_id',user).eq('connection_id',avatar.connection_id).eq('avatar_id',avatar.id).eq('aspect_ratio',aspect).eq('verification_version',1);
 // A completed visual review belongs to the actual avatar look, not a single
 // animation model. Reuse it when the same avatar stays in the same shape;
 // only a newly selected avatar needs another short paid check.
 if(reuseKnownAvatar)query=query.order('visual_approved_at',{ascending:false}).limit(1);
 else query=query.eq('engine',engine);
 const {data,error}=await query.maybeSingle();
 if(error)throw new PublicError('VERIFICATION','Could not check avatar readiness. Retry before generating.',503);
 return data&&data.visual_approved_at&&data.thumbnail_url===avatar.thumbnail_url?data:null;
}

export async function verifySavedAvatar(db:SupabaseClient,user:string,testId:string,visualApproved:boolean=false){
 if(visualApproved!==true)throw new PublicError('VISUAL_REVIEW_REQUIRED','Watch the saved test and confirm that only the person remains before approving this look.',409);
 const {data:job,error}=await db.from('creator_presenter_tests').select('*').eq('id',testId).eq('user_id',user).single();
 if(error||!job||job.status!=='completed'||job.snapshot?.scope!=='test')throw new PublicError('TEST_REQUIRED','Complete a short avatar test first.',409);
 const {data:avatar}=await db.from('avatar_profiles').select('*').eq('user_id',user).eq('connection_id',job.connection_id).eq('provider_avatar_id',job.snapshot.avatar_id).eq('status','ready').maybeSingle();
 if(!avatar||!('look_thumbnail_url' in job.snapshot)||job.snapshot.look_thumbnail_url!==avatar.thumbnail_url)throw new PublicError('LOOK_CHANGED','This test belongs to an older look. Review a new short test before full generation.',409);
 const frame=manualVerificationFrame(job.snapshot.aspect_ratio);
 const saved=await db.from('creator_avatar_verifications').upsert({user_id:user,connection_id:job.connection_id,avatar_id:avatar.id,engine:job.snapshot.avatar_engine??'avatar_iv',aspect_ratio:job.snapshot.aspect_ratio,thumbnail_url:avatar.thumbnail_url,test_id:testId,verification_version:1,crop:frame.crop,source_width:frame.source_width,source_height:frame.source_height,verified_at:new Date().toISOString(),visual_approved_at:new Date().toISOString()},{onConflict:'user_id,connection_id,avatar_id,engine,aspect_ratio'});
 if(saved.error)throw new PublicError('VERIFICATION','Could not save the approval. Retry; no new paid test is needed.',503);
 return {verified:true,test_id:testId,crop:frame.crop};
}
