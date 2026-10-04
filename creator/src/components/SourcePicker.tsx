import {useState} from 'react';
import type {ScriptBrief} from '../domain/script-brief';
import type {SourceCut} from '../domain/source-cut';
import type {DraftProgress} from './ScriptProgress';
import {SourceVideo} from './SourceVideo';
import {GraphicSource} from './GraphicSource';

export function SourcePicker({brief,profileId,disabled,busy=false,scope,onSource,onCapture,onVideo,onGraphic,onProcessing,onProgress}:{brief:ScriptBrief;profileId:string;disabled:boolean;busy?:boolean;scope?:string;onSource:(patch:Partial<ScriptBrief>)=>void;onCapture:(capture:NonNullable<ScriptBrief['graphic_capture']>)=>void;onVideo:(text:string,cut:SourceCut)=>Promise<void>;onGraphic:(text:string)=>Promise<void>;onProcessing:(busy:boolean)=>void;onProgress?:(p:DraftProgress)=>void}){
 const [mode,setMode]=useState<'link'|'upload'>(brief.source_cut&&!brief.url?'upload':'link');
 const [file,setFile]=useState<File|null>(null),[error,setError]=useState('');
 const video=brief.kind==='video';
 function selectFile(next:File|undefined){
  if(!next)return;
  const isVideo=['video/mp4','video/webm'].includes(next.type),isImage=['image/png','image/jpeg','image/webp'].includes(next.type);
  if(!isVideo&&!isImage){setError('Choose an MP4 or WebM video, or a PNG, JPEG or WebP screenshot.');return;}
  if(next.size>(isVideo?500:10)*1024*1024){setError(isVideo?'Choose a video under 500 MB.':'Choose a screenshot under 10 MB.');return;}
  setError('');setFile(next);onSource({kind:isVideo?'video':'graphic',url:''});
 }
 return <section aria-label="Add your reaction source" className="reaction-source-picker">
  <h2>What would you like to react to?</h2>
  <div className="take-modes" aria-label="Add a link or file">
   <button type="button" disabled={busy} aria-pressed={mode==='link'} onClick={()=>setMode('link')}>Paste a link</button>
   <button type="button" disabled={busy} aria-pressed={mode==='upload'} onClick={()=>setMode('upload')}>Upload a file</button>
  </div>
  {mode==='link'?<>
   <p>Instagram, TikTok, YouTube, or an article from any website.</p>
   <label>Post, video or article link<input type="url" maxLength={2000} disabled={busy} value={brief.url} placeholder="Paste your link here…" onChange={e=>onSource({url:e.target.value})}/></label>
   <fieldset disabled={busy}><legend>What should we use from this link?</legend><div className="take-modes">
    <button type="button" aria-pressed={video} onClick={()=>onSource({kind:'video'})}>Video</button>
    <button type="button" aria-pressed={!video} onClick={()=>onSource({kind:'graphic'})}>Post or article</button>
   </div></fieldset>
   <p><small>{video?'Download the available video and use its sound and visuals for your reaction.':'Capture the public post graphic or article screenshot, and read its text and available caption.'} If the site blocks access, upload your own file instead.</small></p>
  </>:<><p>Choose a video or screenshot from your phone or computer. We’ll recognize the file type.</p><label>Video or screenshot<input type="file" accept="video/mp4,video/webm,image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{selectFile(e.target.files?.[0]);e.target.value='';}}/></label><small>Videos: MP4 / WebM, up to 3 minutes and 500 MB. Screenshots: PNG / JPEG / WebP, up to 10 MB.</small>{file&&<p>{video?'Video':'Screenshot'} selected: {file.name}</p>}</>}
  {error&&<p role="alert">{error}</p>}
  {(mode==='link'||file||brief.source_cut||brief.graphic_capture)&&(video?<SourceVideo key={`${mode}:${file?.name}:${file?.lastModified}:${profileId}`} {...{mode,profileId,disabled,onProcessing,onProgress}} scope={scope?`${scope}:${profileId}`:undefined} url={brief.url} initialFile={file??undefined} hideInput onUrl={url=>onSource({url})} onComplete={onVideo}/>:<GraphicSource key={`${mode}:${file?.name}:${file?.lastModified}`} mode={mode} initialFile={file??undefined} capture={brief.graphic_capture} url={brief.url} {...{profileId,disabled,onProcessing,onCapture}} onComplete={onGraphic}/>)}
 </section>;
}
