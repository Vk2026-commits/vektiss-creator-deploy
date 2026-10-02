import {mediaFetch} from './media-fetch';
import {analyzeVideo} from './video-analysis';
import type {SourceCut} from '../domain/source-cut';
export async function saveSourceVideo(blob:Blob,end?:number):Promise<string>{
 const response=await mediaFetch('/api/local-capture/video-background',{method:'POST',headers:{'Content-Type':blob.type,...(end===undefined?{}:{'X-Source-End':String(end)})},body:blob});
 if(!response.ok){const failure=await response.json().catch(()=>null);throw Error(failure?.error??'Could not save the selected clip.');}
 const data=await response.json();if(typeof data.id!=='string')throw Error('Invalid saved clip.');return data.id;
}
export async function loadSourceVideo(id:string){
 const response=await mediaFetch(`/api/local-capture/video-background/${id}`);if(!response.ok)throw Error('Saved source is unavailable. Please upload it again.');return response.blob();
}
export async function analyzeSelection(original:Blob,originalId:string,duration:number,end:number,reason:string,profileId:string,progress:(s:string)=>void){
 if(!Number.isFinite(end)||end<1||end>duration)throw Error('Choose an ending between 1 second and the source duration.');
 progress('Saving the original footage selection…');
 const selectedId=end>=duration-.05?originalId:await saveSourceVideo(original,end);
 const selected=selectedId===originalId?original:await loadSourceVideo(selectedId);
 const result=await analyzeVideo(selected,profileId,progress);
 const cut:SourceCut={original_id:originalId,selected_id:selectedId,duration,end,reason};
 return {text:result.text,cut};
}
