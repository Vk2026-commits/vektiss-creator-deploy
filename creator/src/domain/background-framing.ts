import {z} from 'zod';
export const backgroundFramingSchema=z.object({mode:z.enum(['fit','fill']),zoom:z.number().min(1).max(3),x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict();
export type BackgroundFraming=z.infer<typeof backgroundFramingSchema>;
export const fillBackground:BackgroundFraming={mode:'fill',zoom:1,x:.5,y:0};
export function backgroundImageStyle(value?:BackgroundFraming){
 if(!value||value.mode==='fit')return {objectFit:'contain' as const,objectPosition:'center top',width:'100%',height:'100%',left:0,top:0};
 return {objectFit:'cover' as const,objectPosition:`${value.x*100}% ${value.y*100}%`,width:`${value.zoom*100}%`,height:`${value.zoom*100}%`,left:`${(1-value.zoom)*value.x*100}%`,top:`${(1-value.zoom)*value.y*100}%`};
}
export function backgroundFilter(w:number,h:number,value?:BackgroundFraming){
 if(!value||value.mode==='fit')return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:0:color=0xe8edf4`;
 const v=backgroundFramingSchema.parse(value);
 return `scale=${w}:${h}:force_original_aspect_ratio=increase,scale=ceil(iw*${v.zoom}/2)*2:ceil(ih*${v.zoom}/2)*2,crop=${w}:${h}:(iw-ow)*${v.x}:(ih-oh)*${v.y}`;
}
