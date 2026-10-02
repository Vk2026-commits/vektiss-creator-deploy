export async function selectedVoiceForPlan(plan:{voice?:{id:string}},avatar:{provider_voice_id:string|null;voice_name:string|null},lookup:(id:string)=>Promise<{provider_voice_id:string;name:string}>){
 if(!plan.voice)return {provider_voice_id:avatar.provider_voice_id, name:avatar.voice_name};
 const voice=await lookup(plan.voice.id);
 if(voice.provider_voice_id!==plan.voice.id)throw Error('Voice validation returned a different voice.');
 return voice;
}
