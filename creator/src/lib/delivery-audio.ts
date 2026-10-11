// Decode locally; only bounded mono PCM reaches the analysis service. No media
// is written to localStorage, the app's media cache, or a storage bucket.
export async function deliveryAudio(file:Blob):Promise<Blob>{
 if(!file.size||file.size>100*1024*1024)throw Error('Choose an audio or video recording under 100 MB.');
 const context=new AudioContext();
 try{
  const audio=await context.decodeAudioData(await file.arrayBuffer());
  if(audio.duration<10||audio.duration>90)throw Error('Choose a 10–90 second clip. We recommend 30–60 seconds with an opening, explanation, and closing.');
  const offline=new OfflineAudioContext(1,Math.ceil(audio.duration*16000),16000);
  const source=offline.createBufferSource();source.buffer=audio;source.connect(offline.destination);source.start();
  const rendered=await offline.startRendering();
  return pcmWav(rendered.getChannelData(0));
 }catch(e){if(e instanceof Error&&e.message.startsWith('Choose'))throw e;throw Error('This browser could not read the audio. Upload an MP3, WAV, or a shorter MP4 instead.');}
 finally{await context.close();}
}
export function pcmWav(samples:Float32Array){
 const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
 const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
 text(0,'RIFF');v.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
 return new Blob([bytes],{type:'audio/wav'});
}
