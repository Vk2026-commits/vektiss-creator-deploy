import {afterEach,describe,expect,it,vi} from 'vitest';
import {createVideoPoster} from '../src/lib/video-poster';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function fixture(){
 vi.useFakeTimers();
 const media={duration:60,videoWidth:1080,videoHeight:1920,currentTime:0,load:vi.fn(),removeAttribute:vi.fn(),onloadedmetadata:null as null|(()=>void),onseeked:null as null|(()=>void),onerror:null as null|(()=>void)};
 const drawImage=vi.fn();
 const canvas={width:0,height:0,getContext:()=>({drawImage}),toDataURL:()=> 'data:image/jpeg;base64,frame'};
 vi.stubGlobal('document',{createElement:(tag:string)=>tag==='video'?media:canvas});
 return {media,canvas,drawImage};
}
describe('finished MP4 poster',()=>{
 it('captures a scaled frame from the final video without playing it',()=>{
  const {media,canvas,drawImage}=fixture();const ready=vi.fn();
  createVideoPoster('blob:final',ready);media.onloadedmetadata?.();
  expect(media.currentTime).toBe(0.1);media.onseeked?.();
  expect(canvas.width).toBe(720);expect(canvas.height).toBe(1280);
  expect(drawImage).toHaveBeenCalled();expect(ready).toHaveBeenCalledWith('data:image/jpeg;base64,frame');
  expect(media.removeAttribute).toHaveBeenCalledWith('src');
 });
 it('cancels decoder work on project changes and times out safely',()=>{
  const {media}=fixture();const ready=vi.fn();const cancel=createVideoPoster('blob:old',ready);
  cancel();expect(media.onseeked).toBeNull();expect(ready).not.toHaveBeenCalled();
  createVideoPoster('blob:new',ready);vi.advanceTimersByTime(15000);
  expect(media.onseeked).toBeNull();expect(ready).not.toHaveBeenCalled();
 });
});
