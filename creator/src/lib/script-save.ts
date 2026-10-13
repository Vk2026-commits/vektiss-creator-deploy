import type {Script,ScriptInput} from '../domain/scripts';
import type {VideoRender} from '../domain/video-plan';
import {speechIdentity} from '../domain/video-versions';

export type ScriptStore={
 list:()=>Promise<Script[]>;
 save:(input:ScriptInput,existing:Script|null)=>Promise<Script>;
};

function isStale(error:unknown){
 return error instanceof Error&&error.message==='STALE';
}

/**
 * Reapply an editor's full draft to a newer server row while retaining a
 * render status that changed in the background after the editor opened.
 */
export function rebaseScriptEdit(latest:Script,input:ScriptInput):ScriptInput{
 const brief={...latest.brief,...input.brief};
 if(input.brief.production&&latest.brief.production?.render){
  if(speechIdentity(latest)!==speechIdentity(input))throw Error('This version started rendering in another tab. Reopen it before changing its voice or script.');
  brief.production={...input.brief.production,render:latest.brief.production.render};
 }
 return {...latest,...input,brief};
}

/** Add only a render-state update to the newest saved script. */
export function rebaseRenderState(latest:Script,render:VideoRender):ScriptInput{
 if(!latest.brief.production)return latest;
 return {...latest,brief:{...latest.brief,production:{...latest.brief.production,render}}};
}

/**
 * A conditional save protects against genuine concurrent editing. For the
 * expected local race between the editor and render-status persistence, read
 * the latest row, merge the targeted change, and retry exactly once.
 */
export async function saveScriptWithRebase(store:ScriptStore,input:ScriptInput,existing:Script|null,rebase:(latest:Script)=>ScriptInput=(latest)=>rebaseScriptEdit(latest,input)):Promise<Script>{
 try{return await store.save(input,existing);}
 catch(error){
  if(!existing||!isStale(error))throw error;
  const latest=(await store.list()).find(item=>item.id===existing.id);
  if(!latest)throw error;
  return store.save(rebase(latest),latest);
 }
}
