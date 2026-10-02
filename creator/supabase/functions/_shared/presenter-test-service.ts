import type {SupabaseClient} from '@supabase/supabase-js';
import {PublicError} from './avatar-contract.ts';
import {providerVideo,testExcerpt,testPayload,fullScript,type TestCommand} from './presenter-test.ts';
import {credentialVault,type SealedCredential} from './credential-crypto.ts';
import {HeyGenCatalog} from './heygen.ts';
import {selectedVoiceForPlan} from './selected-voice.ts';

export function presenterTestService(db:SupabaseClient,vault:ReturnType<typeof credentialVault>){
 async function displayJob(job:Record<string,unknown>){
  if(typeof job.cleaned_path!=='string')return job;
  if(!job.cleaned_path.startsWith(`${job.user_id}/`))throw Error('INVALID_MEDIA_OWNER');
  const signed=await db.storage.from('creator-render-assets').createSignedUrl(job.cleaned_path,3600);
  if(signed.error)throw new PublicError('MEDIA','Could not load the cleaned video. Refresh status.',503);
  const download=await db.storage.from('creator-render-assets').createSignedUrl(job.cleaned_path,3600,{download:'vektiss-presenter-cleaned.webm'});
  if(download.error)throw new PublicError('MEDIA','Could not prepare the video download. Refresh status.',503);
  let preview_url:string|null=null;
  let preview_download_url:string|null=null;
  if(typeof job.preview_path==='string'&&job.preview_path.startsWith(`${job.user_id}/`)){
   const preview=await db.storage.from('creator-render-assets').createSignedUrl(job.preview_path,3600);
   if(!preview.error)preview_url=preview.data.signedUrl;
   const previewDownload=await db.storage.from('creator-render-assets').createSignedUrl(job.preview_path,3600,{download:'vektiss-presenter-preview.mp4'});
   if(!previewDownload.error)preview_download_url=previewDownload.data.signedUrl;
  }
  return {...job,video_url:signed.data.signedUrl,download_url:download.data.signedUrl,preview_url,preview_download_url,cleanup_applied:true};
 }
 async function keyFor(user:string,connection:string){
  const {data,error}=await db.rpc('creator_read_credential',{p_user_id:user,p_connection_id:connection});
  if(error||!data?.[0])throw new PublicError('CONNECTION','Reconnect your HeyGen account.',409);
  return vault.open(data[0] as SealedCredential,{userId:user,connectionId:connection,provider:'heygen'});
 }
 return async(user:string,command:TestCommand)=>{
  if(command.action==='test_status'||command.action==='download_test'){
   const {data:job,error}=await db.from('creator_presenter_tests').select('*').eq('id',command.test_id).eq('user_id',user).single();
   if(error||!job)throw new PublicError('NOT_FOUND','Test not found.',404);
   if(command.action==='download_test'){
    if(job.status!=='completed'||!job.video_url)throw new PublicError('NOT_READY','Refresh the completed test before downloading.',409);
    if(job.cleaned_path){
     if(!job.cleaned_path.startsWith(`${user}/`))throw Error('INVALID_MEDIA_OWNER');
     const file=await db.storage.from('creator-render-assets').download(job.cleaned_path);
     if(file.error)throw new PublicError('DOWNLOAD','Could not download the cleaned video. Please retry.',503);
     return new Response(file.data,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="vektiss-presenter-cleaned.webm"','cache-control':'no-store'}});
    }
    const url=new URL(job.video_url);
    if(url.protocol!=='https:'||url.username||url.password||!['heygen.ai','heygen.com'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw new PublicError('DOWNLOAD','This media host cannot be downloaded here.',400);
    const upstream=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!upstream.ok||!upstream.body)throw new PublicError('DOWNLOAD','The video link expired. Refresh test status, then download again.',502);
    const reader=upstream.body.getReader();let bytes=0;
    const stream=new ReadableStream({async pull(controller){try{const chunk=await reader.read();if(chunk.done){controller.close();return;}bytes+=chunk.value.byteLength;if(bytes>50*1024*1024){await reader.cancel();controller.error(new Error('Download too large'));return;}controller.enqueue(chunk.value);}catch(error){controller.error(error);}},cancel(){return reader.cancel();}});
    return new Response(stream,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="vektiss-presenter-test.webm"','cache-control':'no-store'}});
   }
   if(job.cleaned_path||!job.provider_video_id||job.status==='failed')return displayJob(job);
   const key=await keyFor(user,job.connection_id);
   const data=await providerVideo(key,`/${encodeURIComponent(job.provider_video_id)}`);
   const status=data.status==='completed'?'completed':data.status==='failed'?'failed':data.status==='processing'?'processing':'pending';
   let video_url:string|null=null;
   if(typeof data.video_url==='string'){
    try{const url=new URL(data.video_url);if(url.protocol==='https:'&&!url.username&&!url.password)video_url=url.href;}catch{/* no unsafe media links */}
   }
   const patch={status,video_url,message:status==='failed'?'HeyGen could not complete this test. Review it in your HeyGen dashboard before another attempt.':job.message};
   const saved=await db.from('creator_presenter_tests').update(patch).eq('id',job.id).eq('user_id',user).select('*').single();
   if(saved.error)throw Error('STORAGE');return displayJob(saved.data);
  }
  const {data:script,error}=await db.from('creator_scripts').select('*').eq('id',command.script_id).eq('user_id',user).single();
  const plan=script?.brief?.production;
  if(error||!script||plan?.step!=='saved'||!plan.approved_at||plan.presenter!=='avatar')throw new PublicError('SAVE_PLAN','Save an approved avatar video plan first.',409);
  const {data:avatar,error:avatarError}=await db.from('avatar_profiles').select('*').eq('id',plan.avatar_id).eq('user_id',user).single();
  if(avatarError||!avatar||avatar.status!=='ready'||(!avatar.provider_voice_id&&!plan.voice?.id))throw new PublicError('AVATAR','Choose a ready presenter with a voice.',409);
  // Validate the chosen voice through this user's connected HeyGen account.
  const selectedVoice=await selectedVoiceForPlan(plan,avatar,async id=>new HeyGenCatalog(await keyFor(user,avatar.connection_id)).getVoice(id));
  const scope=command.scope??'test';
  if(plan.voice_engine!==undefined&&!['auto','fish'].includes(plan.voice_engine))throw new PublicError('VOICE_ENGINE','Choose a supported voice engine.',400);
  const snapshot={scope,avatar_id:avatar.provider_avatar_id,voice_id:selectedVoice?.provider_voice_id??avatar.provider_voice_id,avatar_name:avatar.name,voice_name:selectedVoice?.name??avatar.voice_name,script:scope==='full'?fullScript(script):testExcerpt(script),aspect_ratio:plan.format==='portrait'?'9:16':plan.format==='square'?'1:1':'16:9'};
  // Include the engine in the paid-job revision; never reuse audio from another engine.
  const engineSnapshot=snapshot as typeof snapshot & {voice_engine?:string};
  if(plan.voice_engine==='fish')engineSnapshot.voice_engine='fish';
  if(!snapshot.script.trim())throw new PublicError('SCRIPT','The script is empty.');
  // Size, article and save timestamps do not change the paid presenter asset.
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({connection_id:avatar.connection_id,snapshot})));
  const revision=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  const prior=await db.from('creator_presenter_tests').select('*').eq('script_id',script.id).eq('revision',revision).eq('user_id',user).maybeSingle();
  if(prior.error)throw Error('STORAGE');
  if(command.action==='prepare_test')return {revision,snapshot,job:prior.data?await displayJob(prior.data):null,estimated_seconds:Math.ceil(snapshot.script.split(/\s+/).length/2.5)};
  if(command.revision!==revision)throw new PublicError('STALE','The saved plan or presenter changed. Review the test again.',409);
  if(prior.data)return displayJob(prior.data);
  // Read credentials BEFORE reserving, but reserve durably BEFORE any paid call.
  const key=await keyFor(user,avatar.connection_id);
  const id=crypto.randomUUID();
  const reserved=await db.from('creator_presenter_tests').insert({id,user_id:user,script_id:script.id,revision,connection_id:avatar.connection_id,snapshot}).select('*').single();
  if(reserved.error)throw new PublicError('EXISTS','A test may already be starting. Refresh its status; do not submit again.',409);
  try{
   const result=await providerVideo(key,'',testPayload(snapshot));
   if(typeof result.video_id!=='string'||!result.video_id)throw Error('UNKNOWN_SUBMISSION');
   const saved=await db.from('creator_presenter_tests').update({provider_video_id:result.video_id,status:'pending',output_format:typeof result.output_format==='string'?result.output_format:null,message:result.output_format==='webm'?null:'Provider format not confirmed. Inspect output before using it as a cutout.'}).eq('id',id).select('*').single();
   if(saved.error)throw Error('STORAGE');return saved.data;
  }catch(error){
   const rejected=error instanceof PublicError&&error.code==='RENDER_REJECTED';
   const message=rejected?error.message:'Submission outcome is uncertain. Check HeyGen before trying another render; it may have used credits. No automatic retry was made.';
   const saved=await db.from('creator_presenter_tests').update({status:rejected?'failed':'uncertain',message}).eq('id',id).select('*').single();
   if(saved.error)throw new PublicError('UNCERTAIN',message,503);return saved.data;
  }
 };
}
