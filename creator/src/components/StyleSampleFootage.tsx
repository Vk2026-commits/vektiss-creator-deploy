import {useEffect,useRef} from 'react';
export function StyleSampleFootage({url,frame}:{url:string;frame:number}){
 const ref=useRef<HTMLVideoElement>(null);
 const seek=()=>{const v=ref.current;if(v&&Number.isFinite(v.duration))v.currentTime=Math.max(0,Math.min(frame/30,v.duration-.04));};
 useEffect(seek,[frame,url]);
 return <video ref={ref} src={url} muted playsInline preload="auto" onLoadedMetadata={seek} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'50% 30%'}}/>;
}
