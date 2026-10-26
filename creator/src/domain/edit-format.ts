import {z} from 'zod';
export const editAspectRatio=z.enum(['9:16','16:9']);
export type EditAspectRatio=z.infer<typeof editAspectRatio>;
export function editDimensions(ratio:EditAspectRatio='9:16'){return ratio==='16:9'?{width:1920,height:1080}:{width:1080,height:1920};}
