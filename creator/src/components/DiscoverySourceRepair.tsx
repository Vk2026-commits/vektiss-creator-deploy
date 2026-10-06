import {useState} from 'react';
import {SourcePicker} from './SourcePicker';
import type {ScriptBrief} from '../domain/script-brief';
export function DiscoverySourceRepair({brief,profileId,scope,onRepair}:{brief:ScriptBrief;profileId:string;scope:string;onRepair:(brief:ScriptBrief)=>void}){
 const [source,setSource]=useState(brief),[busy,setBusy]=useState(false);
 return <section><h2>Restore your Discover background</h2><p>This older draft skipped source preparation. Prepare the original link below. Your script, avatar and placement will be kept; this does not start a new HeyGen render.</p>
 <SourcePicker brief={source} profileId={profileId} scope={`${scope}:repair`} disabled={false} busy={busy} onProcessing={setBusy}
 onSource={patch=>{setSource(s=>({...s,...patch}));if(patch.prepared_source&&patch.prepared_source.kind!=='video')onRepair({...brief,...patch,production:{...brief.production!,article_capture:patch.prepared_source.capture}});}}
 onCapture={capture=>setSource(s=>({...s,graphic_capture:capture}))}
 onVideo={async (_text,cut)=>onRepair({...brief,...source,kind:'video',source_cut:cut,production:{...brief.production!,video_background:{id:cut.selected_id,source_url:source.url}}})}
 onGraphic={async()=>{}}/>
 </section>;
}
