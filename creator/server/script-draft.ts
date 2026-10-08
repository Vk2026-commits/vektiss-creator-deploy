import {z} from 'zod';
import {scriptSchema,type Script,type ScriptInput} from '../src/domain/scripts';
import {suggestedVideoTitle} from '../src/domain/video-title';
import type {ScriptBrief} from '../src/domain/script-brief';

export class DraftError extends Error {}
const command=z.object({script_id:z.string().uuid(),revision:z.string(),action:z.enum(['summarize','summary_only','clarify','generate'])});
// The user's own bearer token/RLS authorize every read and write. No service-role key.
export async function createSavedDraft(input:unknown,authorization:string,config:{supabaseUrl:string;publicKey:string}){
 const request=command.parse(input);
 const headers={Authorization:authorization,apikey:config.publicKey,'Content-Type':'application/json'};
 const table=`${config.supabaseUrl}/rest/v1/creator_scripts`;
 const response=await fetch(`${table}?id=eq.${request.script_id}&select=*`,{headers,signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new DraftError('Could not load the saved source. Sign in and try again.');
 let [snapshot]=await response.json() as Script[];
 if(!snapshot||snapshot.updated_at!==request.revision)throw new DraftError('This video changed. Reopen it before creating another draft.');
 let next:ScriptInput=scriptSchema.parse(snapshot);
 async function save(){
  const value=scriptSchema.parse(next);
  const saved=await fetch(`${table}?id=eq.${request.script_id}&updated_at=eq.${encodeURIComponent(snapshot.updated_at)}`,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(value),signal:AbortSignal.timeout(30000)});
  if(!saved.ok)throw new DraftError('Could not save the draft. Your previous script is preserved.');
  const items=await saved.json();if(items.length!==1)throw new DraftError('This video was edited elsewhere. Your newer changes were preserved.');
  snapshot=items[0];
 }
 async function ai(action:string,brief:ScriptBrief){
  const result=await fetch(`${config.supabaseUrl}/functions/v1/script-assistant`,{method:'POST',headers,body:JSON.stringify({action,profileId:next.content_profile_id,brief:{...brief,cost_project_id:brief.cost_project_id??request.script_id}}),signal:AbortSignal.timeout(150000)});
  const data=await result.json();
  if(!result.ok)throw new DraftError(data?.code==='RATE_LIMIT'?'AI request limit reached. Your saved source is preserved; retry later.':data?.code==='SCRIPT_STYLE'?'The draft did not meet the profile’s style. Retry the draft using your saved source.':'AI could not finish. Your saved source and previous script are preserved.');
  return data;
 }
 let action:string=request.action;
 const brief={...next.brief,questions:next.brief.questions.filter(q=>q.answer.trim())};
 let result=await ai(action==='summary_only'?'summarize':action,brief);
 if(action==='summary_only'){
  next={...next,brief:{...next.brief,source_summary:z.string().parse(result.summary)}};
  await save();return snapshot;
 }
 if(action==='summarize'){
  next={...next,title:suggestedVideoTitle(next.title,result.title),brief:{...brief,source:result.source,source_summary:result.summary,stage:'source',clarified:false,questions:[],summary:'',production:undefined}};
  if(!snapshot.body.trim())await save();action='generate';result=await ai(action,next.brief);
 }else if(action==='clarify'){
  const questions=z.array(z.string().max(1000)).parse(result.questions);
  next={...next,brief:{...brief,summary:result.summary,questions:[...brief.questions.slice(-4),...questions.slice(0,1).map(question=>({question,answer:''}))],clarified:true,stage:'clarify'}};
  if(questions.length){await save();return snapshot;}
  if(!snapshot.body.trim())await save();action='generate';result=await ai(action,next.brief);
 }
 next={...next,hook:result.hook,body:result.body,cta:result.cta,brief:{...next.brief,production:undefined,review:result.review,stage:'review'}};
 await save();return snapshot;
}
