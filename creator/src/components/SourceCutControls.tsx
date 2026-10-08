import {useEffect,useRef,useState} from 'react';
export function SourceCutControls({blob,end,onEnd,disabled,onDuration}:{blob:Blob;end:number;onEnd:(value:number)=>void;disabled:boolean;onDuration?:(value:number)=>void}){
 const [url,setUrl]=useState(''),[duration,setDuration]=useState(180);const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const next=URL.createObjectURL(blob);setUrl(next);return()=>URL.revokeObjectURL(next);},[blob]);
 function change(value:number){onEnd(value);if(video.current)video.current.currentTime=Math.max(0,value-.5);}
 return <div className="source-cut-controls"><video ref={video} src={url} controls playsInline preload="metadata" style={{width:'100%',maxHeight:280}} onLoadedMetadata={e=>{const value=e.currentTarget.duration;if(Number.isFinite(value)&&value>0){setDuration(value);onDuration?.(value);if(!end)onEnd(value);}}}/>
  <label>Keep the beginning through (seconds)<input type="number" min="1" max={duration} step="0.05" value={end||''} disabled={disabled} onChange={e=>change(Number(e.target.value))}/></label>
  <input aria-label="Clip ending" type="range" min="1" max={duration} step="0.05" value={end||duration} disabled={disabled} onChange={e=>change(Number(e.target.value))}/>
  <button type="button" disabled={disabled} onClick={()=>{if(video.current)onEnd(Math.max(1,video.current.currentTime));}}>Cut at current frame</button>
  <small>Only 0–{end.toFixed(2)}s will play with sound, then loop muted behind your avatar. Embedded commentary cannot be removed by an ending cut.</small>
 </div>;
}
