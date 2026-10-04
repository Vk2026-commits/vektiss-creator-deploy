// Read only the requested community post's attachment, never recommended videos
// or the page-wide og:image (which can be a channel avatar).
export function youtubePostImage(html:string,postId:string):{image:string;caption:string;firstOnly:boolean}|null{
 const raw=html.match(/(?:var\s+)?ytInitialData\s*=\s*(\{.*?\})\s*;/s)?.[1];
 if(!raw)return null;
 let root:unknown;try{root=JSON.parse(raw);}catch{return null;}
 function visit(value:unknown,depth=0):ReturnType<typeof youtubePostImage>{
  if(depth>60||!value||typeof value!=='object')return null;
  const obj=value as Record<string,any>;
  const post=obj.backstagePostRenderer;
  if(post?.postId===postId){
   const attachment=post.backstageAttachment;
   const images=attachment?.postMultiImageRenderer?.images;
   const thumbnails=(images?.[0]?.backstageImageRenderer??attachment?.backstageImageRenderer)?.image?.thumbnails;
   const image=Array.isArray(thumbnails)?thumbnails.at(-1)?.url:null;
   const caption=Array.isArray(post.contentText?.runs)?post.contentText.runs.map((r:{text?:string})=>r.text??'').join('').slice(0,2000):'';
   return typeof image==='string'?{image,caption,firstOnly:!!images}:null;
  }
  for(const child of Object.values(obj)){const found=visit(child,depth+1);if(found)return found;}
  return null;
 }
 return visit(root);
}
