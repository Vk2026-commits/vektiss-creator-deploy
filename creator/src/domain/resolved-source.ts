import {z} from 'zod';
import {graphicCaptureSchema} from './video-plan.ts';
export const resolvedSourceSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('video'),original_id:z.string().uuid(),firstOnly:z.boolean().optional()}),
 z.object({kind:z.literal('graphic'),capture:graphicCaptureSchema,firstOnly:z.boolean().optional()}),
 z.object({kind:z.literal('article'),capture:graphicCaptureSchema,firstOnly:z.boolean().optional()}),
]);
export type ResolvedSource=z.infer<typeof resolvedSourceSchema>;
export function composerInput(text:string){
 const links=text.match(/https?:\/\/[^\s<>]+/gi)??[];
 return {links,notes:text.replace(/https?:\/\/[^\s<>]+/gi,'').trim()};
}
