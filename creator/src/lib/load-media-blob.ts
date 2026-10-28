const chunkSize=4*1024*1024;
// Keep each authenticated response small enough to travel through the web proxy.
// Retrying a failed body transfer never creates a new render.
export async function loadMediaBlob(path:string,request:(path:string,init:RequestInit)=>Promise<Response>,progress:(percent:number)=>void=()=>{}){
 const chunks:Blob[]=[];let received=0,total=0;
 do{
  let part:Blob|undefined,end=0;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await request(path,{headers:{Range:`bytes=${received}-${received+chunkSize-1}`}});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('video/mp4'))throw Error('Could not load the saved MP4.');
    if(response.status===200&&received===0)return await response.blob();
    const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')??'');
    if(response.status!==206||!range||Number(range[1])!==received)throw Error('Invalid video download range.');
    end=Number(range[2]);const length=Number(range[3]);
    if(end<received||end>=length||(total&&length!==total))throw Error('Video changed during download.');
    part=await response.blob();if(part.size!==end-received+1)throw Error('Incomplete video download.');
    total=length;break;
   }catch{if(attempt===2)throw Error('Your export is saved, but its download was interrupted. Retry export to load it without rendering again.');}
  }
  chunks.push(part!);received=end+1;progress(Math.floor(received/total*100));
 }while(received<total);
 return new Blob(chunks,{type:'video/mp4'});
}
