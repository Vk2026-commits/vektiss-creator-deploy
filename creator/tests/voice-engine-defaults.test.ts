import {describe,it,expect} from 'vitest';
import {newVideoPlan,videoPlanSchema} from '../src/domain/video-plan';
import {testPayload} from '../supabase/functions/_shared/presenter-test';
describe('voice engine and starting layout',()=>{
 it('starts small and centered against the bottom edge',()=>{
  expect(newVideoPlan().presenter_placement).toEqual({x:.5,y:1,width:30});
 });
 it('preserves existing small layouts',()=>{
  expect(videoPlanSchema.parse({...newVideoPlan(),presenter_placement:undefined,presenter_size:28,presenter_position:'bottom-right'}).presenter_size).toBe(28);
 });
 it('sends Fish explicitly, not as an avatar animation engine',()=>{
  const base={avatar_id:'a',voice_id:'v',script:'Hello',aspect_ratio:'9:16'};
  expect(testPayload({...base,voice_engine:'fish'}).voice_settings).toEqual({engine_settings:{engine_type:'fish'}});
  expect(testPayload(base)).not.toHaveProperty('voice_settings');
  expect(videoPlanSchema.safeParse({...newVideoPlan(),voice_engine:'invalid'}).success).toBe(false);
 });
});
