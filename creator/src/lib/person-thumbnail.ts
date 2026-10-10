import {personBounds} from '../domain/person-bounds';
// Crop the existing pixels, not a generative redraw. Only used for new plans
// or an explicitly selected Small overlay shortcut; old plans stay unchanged.
export async function personThumbnail(blob:Blob){
 const bitmap=await createImageBitmap(blob);
 try{
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d');if(!context)throw Error('Preview unavailable');
  context.drawImage(bitmap,0,0);
  const bounds=personBounds(context.getImageData(0,0,bitmap.width,bitmap.height).data,bitmap.width,bitmap.height);
  const cropped=document.createElement('canvas');cropped.width=bounds.width;cropped.height=bounds.height;
  const output=cropped.getContext('2d');if(!output)throw Error('Preview unavailable');
  output.drawImage(bitmap,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
  const png=await new Promise<Blob>((resolve,reject)=>cropped.toBlob(value=>value?resolve(value):reject(Error('Preview unavailable')),'image/png'));
  return {blob:png,aspect:bounds.width/bounds.height};
 }finally{bitmap.close();}
}
