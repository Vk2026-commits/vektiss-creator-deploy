import {it,expect} from 'vitest';
import {providerVideo,videoRejection,validateVoiceEngine} from '../supabase/functions/_shared/presenter-test';
it('preserves useful provider rejection without a paid retry',async()=>{
 let calls=0;
 await expect(providerVideo('secret','',{},async()=>{calls++;return new Response(JSON.stringify({error:{message:'Voice engine fish is not supported for this voice'}}),{status:422});})).rejects.toThrow('Voice engine fish is not supported');
 expect(calls).toBe(1);
});
it('redacts credentials and does not expose raw responses or echoed inputs',()=>{
 expect(videoRejection(JSON.stringify({message:'Invalid secret sk_test_key https://example.com/token',input:{script:'private'}}),'secret')).not.toMatch(/secret|sk_test|https:|private/);
 expect(videoRejection('<html>private request</html>')).not.toContain('private');
 expect(videoRejection('{}')).not.toContain('test settings');
});
it('rejects known incompatible engines and preserves automatic routing',()=>{
 expect(()=>validateVoiceEngine('fish',['elevenlabs'])).toThrow('HeyGen default');
 expect(()=>validateVoiceEngine('auto',['elevenlabs'])).not.toThrow();
 expect(()=>validateVoiceEngine('elevenlabs_v3',['elevenlabs'])).not.toThrow();
 expect(()=>validateVoiceEngine('fish',undefined)).not.toThrow();
});
