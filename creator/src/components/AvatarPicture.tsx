import { useEffect, useState } from 'react';
import { mediaFetch } from '../lib/media-fetch';
import './avatar-picture.css';

export function AvatarPicture({url,name,avatarId}:{url:string|null;name:string;avatarId?:string}) {
 const [failed,setFailed]=useState<string|null>(null);
 const [fallback,setFallback]=useState<string|null>(null);
 const [retry,setRetry]=useState(0);
 const [loading,setLoading]=useState(false);
 const needsFallback=!url||failed===url;
 useEffect(()=>{
  setFallback(null);
  if(!needsFallback||!avatarId)return;
  const controller=new AbortController();let objectUrl:string|undefined;
  setLoading(true);
  void mediaFetch(`/api/local-capture/avatar-thumbnail/${avatarId}`,{signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('Preview unavailable');return response.blob();})
   .then(blob=>{if(controller.signal.aborted)return;objectUrl=URL.createObjectURL(blob);setFallback(objectUrl);})
   .catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[avatarId,url,needsFallback,retry]);
 const src=needsFallback?fallback:url;
 return <span className="avatar-picture">{src?<img src={src} alt={`Preview of ${name}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(src===url)setFailed(url);else setFallback(null);}}/>:<span>{loading?'Loading preview…':'Preview unavailable'}{!loading&&avatarId&&<span role="button" tabIndex={0} onClick={e=>{e.stopPropagation();setRetry(n=>n+1);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setRetry(n=>n+1);}}}> · Retry preview</span>}</span>}</span>;
}
