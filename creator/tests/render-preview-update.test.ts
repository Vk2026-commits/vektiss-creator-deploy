import {expect,it} from 'vitest';
import {newVideoPlan} from '../src/domain/video-plan';
import {mergeRenderPreview,sameAvatarPreview} from '../src/domain/render-preview-update';
it('still detects actual preview changes and missing metadata',()=>{
 const preview={avatar_id:'avatar',engine:'avatar_iii',format:'portrait',aspect:.6};
 expect(sameAvatarPreview(undefined,undefined)).toBe(true);
 expect(sameAvatarPreview(undefined,preview)).toBe(false);
 for(const change of [{avatar_id:'other'},{engine:'avatar_iv'},{format:'square'},{aspect:.7}]){
  expect(sameAvatarPreview(preview,{...preview,...change})).toBe(false);
 }
});
it('does not autosave equivalent metadata reordered by JSONB storage',()=>{
 const current={...newVideoPlan(),avatar_preview:{aspect:.6,format:'portrait',engine:'avatar_iii',avatar_id:'avatar'},video_background:{source_url:'https://example.com',id:'video'}};
 const incoming={...current,avatar_preview:{avatar_id:'avatar',engine:'avatar_iii',format:'portrait',aspect:.6},video_background:{id:'video',source_url:'https://example.com'}};
 expect(mergeRenderPreview(current,incoming)).toBe(current);
});
it('persists verification metadata once and settles after save/reload',()=>{
 const before=newVideoPlan();
 const incoming={...before,avatar_preview:{avatar_id:'avatar',engine:'avatar_iii' as const,format:'portrait' as const,aspect:.6}};
 const saved=mergeRenderPreview(before,incoming);
 expect(saved.avatar_preview).toEqual(incoming.avatar_preview);
 expect(mergeRenderPreview(saved,JSON.parse(JSON.stringify(incoming)))).toBe(saved);
});
it('preserves current layout and render state when preview callbacks arrive',()=>{
 const stale=newVideoPlan();
 const current={...stale,presenter_size:87,render:{job_id:'job',status:'pending' as const,submitted_at:'now',updated_at:'now'}};
 const incoming={...stale,video_background:{id:'video',source_url:'https://example.com'}};
 const next=mergeRenderPreview(current,incoming);
 expect(next.presenter_size).toBe(87);expect(next.render).toBe(current.render);
 expect(next.video_background).toEqual(incoming.video_background);
 expect(mergeRenderPreview(next,incoming)).toBe(next);
});
