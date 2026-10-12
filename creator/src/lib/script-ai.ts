import { supabase } from './supabase';
import type { ScriptBrief } from '../domain/script-brief';
import { withDeadline } from './request-deadline';
export async function scriptAI(action: string, profileId: string, brief?: ScriptBrief, audio?: Blob, projectId?:string) {
  if (!supabase) throw new Error('AI requires a signed-in account.');
  let body: FormData | object = { action, profileId, brief };
  if (audio) { const form = new FormData(); form.set('action','transcribe'); form.set('profileId',profileId); const extension=audio.type.includes('mp4')?'mp4':audio.type.includes('mpeg')?'mp3':audio.type.includes('wav')?'wav':audio.type.includes('ogg')?'ogg':audio.type.includes('m4a')?'m4a':'webm'; form.set('file',audio,`note.${extension}`); body=form; }
  if(body instanceof FormData&&(projectId??brief?.cost_project_id))body.set('projectId',(projectId??brief?.cost_project_id)!);
  const {data,error} = await withDeadline(signal=>supabase!.functions.invoke('script-assistant',{body,signal}),120000,audio?'Transcription timed out. Your recording is still here—download it for safekeeping, then retry.':'AI timed out. Your inputs are still here; please retry.');
  if (error) {
    let code = '';
    let retryAt='';
    try { const failure=await error.context.json();code=failure.code??'';retryAt=failure.retryAt??''; } catch { /* no safe server response */ }
    if(code==='RATE_LIMIT'){
      const reset=new Date(retryAt);
      throw new Error(Number.isFinite(reset.getTime())?`AI testing/request limit reached. Retry after ${reset.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})}. Your source is saved—retry the draft without importing again.`:'AI request limit reached. Your source is saved; please retry later.');
    }
    if(code.startsWith('SOURCE_'))throw new Error(code==='SOURCE_TOO_LONG'?'This article is too long to import. Paste the relevant excerpt instead.':'We couldn’t read this source. Try a public article link, or paste the article text below. Your perspective is not needed yet.');
    if(code==='SCRIPT_STYLE')throw new Error('The draft did not meet your script or CTA requirements. Your source and previous script are safe. Retry draft—no new import needed.');
    throw new Error(code === 'NOT_CONFIGURED' ? 'AI is not connected yet. Your brief is safe—save it and add a server-side OpenAI key to enable transcription and writing.' : code === 'RATE_LIMIT' ? 'AI request limit reached. Try again in an hour.' : 'AI could not complete this request. Your inputs are still here; please retry.');
  }
  return data;
}
