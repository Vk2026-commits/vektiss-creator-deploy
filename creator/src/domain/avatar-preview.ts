// Static placement reference only: never evidence of provider video matting support.
// Match both the saved look and its source image so a changed look cannot use an old cutout.
export function avatarPreviewCutout(id:string|null,thumbnail:string|null){
 if(id==='a1d861d5-215f-4789-92c2-8a16f62f47c0'&&thumbnail==='https://files2.heygen.ai/avatar/v3/91182ae2e1cd4a47a5f2b9e9e0b56084/half/2.2/preview_target.webp')return {
  url:'/brand/rose-preview-cutout-v1.png',viewBox:'529 78 612 863',width:1672,height:941,
 };
 return null;
}
