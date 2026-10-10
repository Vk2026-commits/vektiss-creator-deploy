// User-requested static placement artwork only: never render evidence or approval.
// Bind to both the saved look and its source thumbnail so refreshes cannot reuse
// this artwork for a different provider look. Verified footage takes precedence.
export function avatarPreviewCutout(id:string|null,thumbnail:string|null):{url:string;viewBox:string;width:number;height:number}|null{
 if(id==='cebd8766-07ee-44eb-a914-88ba31733319'&&thumbnail){
  try { const url=new URL(thumbnail);
   if(url.hostname==='files2.heygen.ai'&&url.pathname==='/talking_photo/9b0cb20813cc48cfa09c17368f69eec6/152377e920d5486495fa7b8801d677cc.WEBP')
    return {url:'/brand/rose-practice-preview-v1.png',viewBox:'0 0 937 1679',width:937,height:1679};
  } catch { /* Unknown source: preserve normal provider preview. */ }
 }
 return null;
}
