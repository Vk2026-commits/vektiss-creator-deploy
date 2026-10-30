import {z} from 'zod';

const color=z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color, such as #1688FF.');
export const editBrandSchema=z.object({
 primary:color,background:color,text:color,
 captionStyle:z.enum(['highlight','clean','bold','none']),
 fontFamily:z.enum(['Arial','Georgia','Verdana']).optional(),
 presenterTreatment:z.enum(['head-pop','cutout','window']).optional(),
 motionStyle:z.enum(['calm','balanced','snappy']).optional(),
}).strict();
export type EditBrand=z.infer<typeof editBrandSchema>;
export const defaultEditBrand:EditBrand={primary:'#1688FF',background:'#F4F8FF',text:'#10263D',captionStyle:'highlight'};
export const captionStyles=[
 {id:'highlight',name:'Word highlight',description:'Highlight the spoken word in your brand color.'},
 {id:'clean',name:'Clean subtitles',description:'Simple sentence-case captions without word highlights.'},
 {id:'bold',name:'Bold social',description:'Large uppercase captions with a brand-color accent.'},
 {id:'none',name:'No captions',description:'Keep graphics and original audio without subtitles.'},
] as const;
