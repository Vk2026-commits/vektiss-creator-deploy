import {z} from 'zod';

// Only engines documented by HeyGen's direct-video API. Panda is Studio-only
// until an explicit API contract is available; never alias it to another engine.
export const voiceEngineSchema=z.enum(['auto','fish','elevenlabs','elevenlabs_v3','starfish']);
export type VoiceEngine=z.infer<typeof voiceEngineSchema>;
export const voiceSpeedSchema=z.number().finite().min(.5).max(1.5);
export const voiceEngineNames:Record<VoiceEngine,string>={auto:'HeyGen default',fish:'Fish',elevenlabs:'ElevenLabs',elevenlabs_v3:'ElevenLabs v3',starfish:'Starfish'};
export const voiceTestText='Here is a quick voice check. Listen to the tone, clarity, and pace to find the right sound for your video.';
export const voicePreviewTextSchema=z.string().trim().min(1).max(1200);
export function videoVoiceSettings(engine:VoiceEngine='auto',speed=1){
 voiceEngineSchema.parse(engine);voiceSpeedSchema.parse(speed);
 return {
  ...(speed!==1?{speed}:{}),
  ...(engine!=='auto'?{engine_settings:engine==='elevenlabs_v3'?{engine_type:'elevenlabs',model:'eleven_v3'}:{engine_type:engine}}:{}),
 };
}
// Speech and video expose different engines. Do not substitute Orca or Panda.
export function audioTestEngine(engine:VoiceEngine,available:string[]=[]):string|null{
 const base=engine==='elevenlabs_v3'?'elevenlabs':engine;
 return (base==='elevenlabs'||base==='starfish')&&available.some(e=>e===base||(base==='elevenlabs'&&e==='elevenlabs_v3'))?base:null;
}
