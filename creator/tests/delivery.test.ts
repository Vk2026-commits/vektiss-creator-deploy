import {describe,it,expect} from 'vitest';
import {closingPreview,deliveryProfileSchema,emptyDelivery} from '../src/domain/delivery';
import {creatorInputSchema,emptyCreator} from '../src/domain/strategy';
import {pcmWav} from '../src/lib/delivery-audio';
import {validateDeliveryWav,parseDeliveryAnalysis} from '../supabase/functions/_shared/delivery-analysis';
import {speechTestPayload} from '../supabase/functions/_shared/voice-preview';
import {videoPlanSchema,newVideoPlan} from '../src/domain/video-plan';
describe('personal delivery',()=>{
 it('preserves older profiles and requires approval for saved preferences',()=>{
  expect(creatorInputSchema.parse({...emptyCreator,display_name:'Rose'}).context.delivery).toBeUndefined();
  expect(deliveryProfileSchema.safeParse(emptyDelivery).success).toBe(false);
  expect(deliveryProfileSchema.parse({...emptyDelivery,version:1,approved_at:new Date().toISOString()}).version).toBe(1);
 });
 it('previews complete opening and final sentences without replacing the closing CTA',()=>{
  expect(closingPreview({hook:'Buying a home?',body:'Here is the news.',cta:'Join my class. Comment CLASS and I will send the link.'})).toBe('Buying a home?\n\nComment CLASS and I will send the link.');
  expect(closingPreview({hook:'',body:'First. This is the end.',cta:''})).toBe('This is the end.');
  expect(closingPreview({hook:'Hi.',body:'',cta:'x'.repeat(1300)})).toBe('');
 });
 it('uses the selected script text in provider settings and therefore the cache key',()=>{
  const voice={provider_voice_id:'rose',name:'Rose',language:'English',available_engines:['starfish']};
  const a=speechTestPayload(voice,'starfish',1,'First ending.');
  const b=speechTestPayload(voice,'starfish',1,'New ending.');
  expect(a.text).toBe('First ending.');expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
 });
 it('does not accept transcripts as audio evidence or unclear analysis',()=>{
  expect(()=>validateDeliveryWav(new TextEncoder().encode('I speak enthusiastically.'))).toThrow();
  expect(()=>parseDeliveryAnalysis(JSON.stringify({...emptyDelivery,usable:false}))).toThrow('clear speech');
  expect(()=>parseDeliveryAnalysis(JSON.stringify({...emptyDelivery,usable:true,transcript:'Private words'}))).toThrow();
 });
 it('bounds and validates local PCM without retaining source data',async()=>{
  const samples=new Float32Array(16000*12);for(let i=0;i<samples.length;i++)samples[i]=Math.sin(i/10)*.2;
  const bytes=new Uint8Array(await pcmWav(samples).arrayBuffer());
  expect(validateDeliveryWav(bytes)).toBe(12);
  bytes.fill(0,44);expect(()=>validateDeliveryWav(bytes)).toThrow('quiet');
  expect(()=>validateDeliveryWav(bytes.subarray(0,600))).toThrow();
 });
 it('adds an ending hold only to new or explicitly changed plans',()=>{
  expect(newVideoPlan().ending_hold).toBe(1);
  const {ending_hold:_,...old}=newVideoPlan();expect(videoPlanSchema.parse(old).ending_hold).toBeUndefined();
 });
});
