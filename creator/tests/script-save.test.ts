import {expect,it} from 'vitest';
import {emptyBrief} from '../src/domain/script-brief';
import {newVideoPlan,type VideoRender} from '../src/domain/video-plan';
import type {Script,ScriptInput} from '../src/domain/scripts';
import {explainError} from '../src/domain/strategy';
import {rebaseRenderState,rebaseScriptEdit,saveScriptWithRebase,type ScriptStore} from '../src/lib/script-save';

const id='11111111-1111-4111-8111-111111111111';
const render:VideoRender={job_id:'22222222-2222-4222-8222-222222222222',status:'ready',submitted_at:'2026-10-12T10:00:00Z',updated_at:'2026-10-12T10:05:00Z',export_id:'a'.repeat(64),message:null};
const original:Script={id,updated_at:'revision-1',content_profile_id:id,title:'Video',hook:'Old hook',body:'Old body',cta:'Old CTA',brief:{...emptyBrief(),stage:'review',production:{...newVideoPlan(),step:'saved',approved_at:'2026-10-12T10:00:00Z'}}};
const edited:ScriptInput={...original,hook:'New hook',body:'New body',brief:{...original.brief,production:{...original.brief.production!,approved_at:null,step:'approve'}}};
const latest:Script={...original,updated_at:'revision-2',brief:{...original.brief,production:{...original.brief.production!,render}}};

it('rejects a changed script instead of attaching an incompatible completed render',()=>{
 expect(()=>rebaseScriptEdit(latest,edited)).toThrow(/Reopen/);
});

it('retries one stale script save with the newest record revision',async()=>{
 const calls:Script[]=[];
 const store:ScriptStore={
  list:async()=>[latest],
  save:async(input,existing)=>{
   if(existing?.updated_at==='revision-1')throw Error('STALE');
   expect(existing?.updated_at).toBe('revision-2');
   const saved={...input,id,updated_at:'revision-3'};
   calls.push(saved);
   return saved;
  },
 };
 const saved=await saveScriptWithRebase(store,original,original);
 expect(calls).toHaveLength(1);
 expect(saved.hook).toBe('Old hook');
 expect(saved.brief.production?.render).toEqual(render);
});

it('applies a background render update without overwriting newly saved script text',()=>{
 const result=rebaseRenderState({...latest,body:'Newly saved body'},render);
 expect(result.body).toBe('Newly saved body');
 expect(result.brief.production?.render).toEqual(render);
});

it('does not mislabel a stale video save as a profile conflict',()=>{
 expect(explainError(Error('STALE'))).toContain('This item changed while it was saving');
 expect(explainError(Error('STALE'))).not.toContain('profile');
});
