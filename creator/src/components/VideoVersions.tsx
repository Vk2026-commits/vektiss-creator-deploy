import type {Script} from '../domain/scripts';
import {finishedVersion,projectId,versionNumber} from '../domain/video-versions';
export type VersionIntent='voice'|'avatar'|'framing';
export function VideoVersions({current,items,busy,onSelect,onCreate}:{current:Script;items:Script[];busy:boolean;onSelect:(s:Script)=>void;onCreate:(intent:VersionIntent)=>void}){
 const versions=items.filter(s=>projectId(s)===projectId(current)).sort((a,b)=>versionNumber(b)-versionNumber(a));
 return <section aria-label="Project versions" className="script-direction">
  <h3>{current.title}</h3>
  <label>Version<select value={current.id} disabled={busy} onChange={e=>{const selected=versions.find(s=>s.id===e.target.value);if(selected)onSelect(selected);}}>{versions.map(s=><option key={s.id} value={s.id}>Version {versionNumber(s)} · {finishedVersion(s)?'Finished':s.brief.production?.render?'Rendering / needs attention':'Draft'}</option>)}</select></label>
  {finishedVersion(current)?<><p>This finished version is read-only. Its original download stays available.</p><h4>Make another version</h4><div className="render-actions"><button type="button" disabled={busy} onClick={()=>onCreate('voice')}>Change voice</button><button type="button" disabled={busy} onClick={()=>onCreate('avatar')}>Change avatar</button><button type="button" disabled={busy} onClick={()=>onCreate('framing')}>Adjust framing</button></div><small>Copies your script, source, and layout. No paid generation starts.</small></>:<p>Editing Version {versionNumber(current)}. Earlier finished versions stay unchanged.</p>}
 </section>;
}
