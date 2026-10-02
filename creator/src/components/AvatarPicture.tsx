import { useState } from 'react';
import './avatar-picture.css';

export function AvatarPicture({url,name}:{url:string|null;name:string}) {
 const [failed,setFailed]=useState<string|null>(null);
 return <span className="avatar-picture">{url&&failed!==url?<img src={url} alt={`Preview of ${name}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(url)}/>:<span>Preview unavailable</span>}</span>;
}
