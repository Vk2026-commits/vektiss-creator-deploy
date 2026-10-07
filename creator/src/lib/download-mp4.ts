export async function downloadMP4(response:Response,onProgress:(received:number,total:number|null)=>void):Promise<Blob>{
 const length=Number(response.headers.get('content-length'));
 const total=Number.isFinite(length)&&length>0?length:null;
 if(!response.body)return response.blob();
 const reader=response.body.getReader();const chunks:Uint8Array<ArrayBuffer>[]=[];let received=0;
 onProgress(0,total);
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){chunks.push(new Uint8Array(value));received+=value.byteLength;onProgress(received,total);}}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 if(total!==null&&received!==total)throw Error('The download was interrupted. Your finished video is saved. Retry loading it; no new render is needed.');
 return new Blob(chunks,{type:'video/mp4'});
}
