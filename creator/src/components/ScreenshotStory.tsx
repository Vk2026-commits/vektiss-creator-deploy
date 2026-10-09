import {useEffect,useRef,useState} from 'react';
import {GraphicImage} from './GraphicPreview';
import {mediaFetch} from '../lib/media-fetch';
import {type ScreenshotStory as Story,storyImageSchema} from '../domain/screenshot-story';
import {ScriptProgress} from './ScriptProgress';
import {recoveryRead,recoveryWrite} from '../lib/recovery-storage';
import {sourceUploadType} from '../domain/upload-type';

export function ScreenshotStory({files,initial,notes,profileId,projectId,scope,onProcessing,onSave,onComplete,onCancel}:{files:File[];initial?:Story;notes:string;profileId:string;projectId?:string;scope:string;onProcessing:(busy:boolean)=>void;onSave:(story:Story)=>void;onComplete:(story:Story,source:string)=>Promise<void>;onCancel:()=>void}){
 const [images,setImages]=useState<Story['images']>(initial?.images??[]),[working,setWorking]=useState(''),[error,setError]=useState('');
 const active=useRef<AbortController|null>(null),dragged=useRef<number|null>(null);
 const processing=useRef(onProcessing);processing.current=onProcessing;
 const complete=useRef(onComplete);complete.current=onComplete;
 useEffect(()=>()=>{active.current?.abort();processing.current(false);},[]);
 function save(next:Story['images']){setImages(next);onSave({version:1,images:next,sections:[]});}
 function move(from:number,to:number){if(active.current||to<0||to>=images.length||from===to)return;const next=[...images];next.splice(to,0,next.splice(from,1)[0]);save(next);}
 async function prepare(analyze=false,extra:File[]=[]){
  if(active.current)return;const controller=new AbortController();active.current=controller;processing.current(true);setError('');setWorking('Saving your screenshots…');
  let next=[...images];
  try{
   let uploads=extra.length?extra:!next.length?files:[];
   if(uploads.length&&next.length+uploads.length>5)throw Error('Use no more than five screenshots.');
   if(uploads.some(file=>!sourceUploadType(file)?.startsWith('image/')||file.size>10*1024*1024))throw Error('Choose PNG, JPEG or WebP screenshots under 10 MB each.');
   uploads=uploads.map(file=>new File([file],file.name,{type:sourceUploadType(file)!,lastModified:file.lastModified}));
   const pendingKey=`${scope}:story-pending`;
   const entries: {tag:string;type:string}[]=uploads.length?uploads.map(file=>({tag:`${scope}:story:${file.name}:${file.size}:${file.lastModified}`,type:file.type})):JSON.parse(recoveryRead(pendingKey)??'[]');
   if(entries.length>5)throw Error('Use no more than five screenshots.');
   if(entries.length)recoveryWrite(pendingKey,JSON.stringify(entries));
   for(const [index,entry] of entries.entries()){
    const file=uploads[index],{tag}=entry;
    const cached=recoveryRead(tag);let image;
    try{image=storyImageSchema.parse(JSON.parse(cached??'null'));}catch{
     const response=await mediaFetch('/api/local-capture/graphic-source',{method:'POST',headers:{'Content-Type':entry.type,'X-Profile-Id':profileId,...(projectId?{'X-Cost-Project':projectId}:{})},body:file,signal:controller.signal},tag,!file);
     const result=await response.json();if(!response.ok)throw Error(result.error??'Screenshot upload failed. Retry to keep already saved images.');
     image=storyImageSchema.parse(result);recoveryWrite(tag,JSON.stringify(image));
    }
    if(!next.some(item=>item.id===image.id)){if(next.length===5)throw Error('Use no more than five screenshots.');next.push(image);}setWorking(`Saved ${next.length} screenshots…`);
   }
   recoveryWrite(pendingKey,null);
   if(!next.length)throw Error('Select screenshots to begin.');
   save(next);
   if(analyze){
    for(let i=0;i<next.length;i++)if(!next[i].analysis){
     setWorking(`Reading screenshot ${i+1} of ${next.length}…`);
     const payload=JSON.stringify({id:next[i].id,analyze:true,context:next[i].context??'',caption:next[i].caption??''});
     const response=await mediaFetch('/api/local-capture/graphic-source',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-Id':profileId,...(projectId?{'X-Cost-Project':projectId}:{})},body:payload,signal:controller.signal},`${scope}:story-analysis:${payload}`);
     const result=await response.json();if(!response.ok||typeof result.text!=='string')throw Error(result.error??'Could not read this screenshot. Add context and retry.');
     next=next.map((image,index)=>index===i?{...image,analysis:result.text.slice(0,6500)}:image);save(next);
    }
    // The parent owns script-generation progress; avoid two overlapping dialogs.
    setWorking('');
    await complete.current({version:1,images:next,sections:[]},next.map((image,i)=>`Screenshot ${i+1} (${image.id}):\n${image.analysis}`).join('\n\n'));
   }
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not prepare the story. Retry using the saved screenshots.');}
  finally{if(!controller.signal.aborted){setWorking('');processing.current(false);}active.current=null;}
 }
 return <section aria-label="Screenshot story"><h3>Your screenshot story</h3><p>Put your screenshots in story order. They will change as your avatar discusses them.</p>
  {!images.length?<><p>{files.length} screenshots selected</p><button className="button" type="button" onClick={()=>void prepare()} disabled={!!working}>Preview screenshots</button></>:<ol className="story-images">{images.map((image,i)=><li key={image.id} draggable={!working} onDragStart={()=>{dragged.current=i;}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged.current!==null)move(dragged.current,i);dragged.current=null;}}><strong>Screenshot {i+1}</strong><GraphicImage id={image.id}/><div><button type="button" disabled={!!working||i===0} aria-label={`Move screenshot ${i+1} earlier`} onClick={()=>move(i,i-1)}>↑</button><button type="button" disabled={!!working||i===images.length-1} aria-label={`Move screenshot ${i+1} later`} onClick={()=>move(i,i+1)}>↓</button><button type="button" disabled={!!working||images.length===1} onClick={()=>save(images.filter((_,index)=>index!==i))}>Remove</button></div><label>Context (optional)<textarea rows={2} maxLength={4000} disabled={!!working} value={image.context??''} onChange={e=>save(images.map((item,index)=>index===i?{...item,context:e.target.value,analysis:undefined}:item))}/></label></li>)}</ol>}
  {notes&&<p>Your direction: {notes}</p>}
  {images.length>0&&images.length<5&&<label>Add screenshots<input type="file" multiple accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={!!working} onChange={e=>{const selected=Array.from(e.target.files??[]);e.target.value='';if(selected.length)void prepare(false,selected);}}/></label>}
  {images.length>0&&<button className="button" type="button" disabled={!!working} onClick={()=>void prepare(true)}>Create my story script →</button>}
  <button type="button" disabled={!!working} onClick={onCancel}>Change source</button>
  {error&&<p role="alert">{error}</p>}{working&&<ScriptProgress progress={{percent:0,indeterminate:true,label:working}}/>}
 </section>;
}
