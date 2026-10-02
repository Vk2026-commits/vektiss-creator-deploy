import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useState} from 'react';
import type {VideoPlan} from '../domain/video-plan';
import {FreePresenter} from './FreePresenter';
export function PresenterPlacement({plan,onChange}:{plan:VideoPlan;onChange:(plan:VideoPlan)=>void}){
 const [url,setUrl]=useState('');const id=plan.video_background?.id;
 useEffect(()=>{const abort=new AbortController();let objectUrl='';setUrl('');if(id)void mediaFetch(`/api/local-capture/video-background/${id}`,{headers:{'X-Creator-Capture':'1'},signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Unavailable');const b=await r.blob();if(!abort.signal.aborted){objectUrl=URL.createObjectURL(b);setUrl(objectUrl);}}).catch(()=>{});return()=>{abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[id]);
 return <section aria-label="Presenter size and placement"><FreePresenter plan={plan} onChange={onChange}>{url?<video src={url} muted playsInline autoPlay loop className="placement-background"/>:<span className="placement-preview-label">Avatar layout · source preview unavailable</span>}</FreePresenter></section>;
}
