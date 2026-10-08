import {it,expect} from 'vitest';
import {testPayload} from '../supabase/functions/_shared/presenter-test';
import {engineEstimate} from '../supabase/functions/_shared/avatar-engine';
import {newVideoPlan,videoPlanSchema} from '../src/domain/video-plan';
import {readFileSync} from 'node:fs';
const base={avatar_id:'a',voice_id:'v',script:'Hello',aspect_ratio:'9:16'};
it.each(['avatar_iii','avatar_iv','avatar_v'])('sends %s explicitly with Fish and transparency',avatar_engine=>{
 const p=testPayload({...base,avatar_engine,voice_engine:'fish'});
 expect(p.engine.type).toBe(avatar_engine);expect(p.output_format).toBe('webm');expect(p.voice_settings?.engine_settings.engine_type).toBe('fish');
});
it('preserves legacy default and distinguishes new plans',()=>{expect(testPayload(base).engine.type).toBe('avatar_iv');expect(newVideoPlan().avatar_engine).toBeNull();const {avatar_engine,...old}=newVideoPlan();expect(videoPlanSchema.parse(old).avatar_engine).toBeUndefined();});
it('persists selections and rejects unknown engines',()=>{expect(videoPlanSchema.parse({...newVideoPlan(),avatar_engine:'avatar_iii'}).avatar_engine).toBe('avatar_iii');expect(videoPlanSchema.safeParse({...newVideoPlan(),avatar_engine:'cinematic'}).success).toBe(false);});
it.each([['avatar_iii',.6],['avatar_iv',4.83],['avatar_v',7.2]])('estimates %s speech only', (engine,cost)=>{expect(engineEstimate(String(engine),'digital_twin',60).estimated_cost_usd).toBe(cost);expect(engineEstimate(String(engine),'studio_avatar',60).estimated_cost_usd).toBeNull();});
it('validates capabilities before reservation and stores estimate outside revision hash',()=>{const s=readFileSync('supabase/functions/_shared/presenter-test-service.ts','utf8');expect(s.indexOf('!look.engines.includes')).toBeLessThan(s.indexOf('const reserved='));expect(s).toContain('snapshot:{...snapshot,cost_estimate:estimate}');expect(s).toContain('if(plan.avatar_engine!==undefined)');});
