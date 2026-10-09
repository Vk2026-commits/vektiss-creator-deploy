import {z} from 'zod';

export const storyImageSchema=z.object({
 id:z.string().uuid(),title:z.string().max(2000),source_url:z.string().max(2000),
 caption:z.string().max(2000).optional(),context:z.string().max(4000).optional(),
 analysis:z.string().max(12000).optional(),
});
export const storySectionSchema=z.object({image_id:z.string().uuid(),text:z.string().trim().min(1).max(19000)});
export const screenshotStorySchema=z.object({
 version:z.literal(1),images:z.array(storyImageSchema).min(1).max(5),
 sections:z.array(storySectionSchema).max(5).default([]),
}).superRefine((story,ctx)=>{
 const ids=story.images.map(image=>image.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Each screenshot may appear only once.'});
 if(story.sections.length&&(story.sections.length!==ids.length||story.sections.some((section,i)=>section.image_id!==ids[i])))ctx.addIssue({code:'custom',message:'Review one script section per screenshot, in story order.'});
});
export type ScreenshotStory=z.infer<typeof screenshotStorySchema>;
export const storyRevisionInput=(story:ScreenshotStory)=>JSON.stringify({images:story.images.map(image=>image.id),sections:story.sections.map(({image_id,text})=>({image_id,text}))});
export const normalizeStorySpeech=(text:string)=>text.replace(/\b911\b/g,'9-1-1').replace(/\s+/g,' ').trim();
export function validateStoryScript(story:ScreenshotStory,script:string){
 screenshotStorySchema.parse(story);
 if(!story.sections.length||normalizeStorySpeech(story.sections.map(s=>s.text).join(' '))!==normalizeStorySpeech(script))throw Error('The story sections do not match the approved script. Review your screenshot story before rendering.');
}
/** Map exact approved words, never let a second model rewrite the narration. */
export function storySectionsFromStarts(story:ScreenshotStory,script:string,starts:unknown){
 const words=script.trim().split(/\s+/);
 const indexes=z.array(z.number().int().nonnegative()).length(story.images.length).parse(starts);
 if(indexes[0]!==0||indexes.some((start,i)=>start>=words.length||(i>0&&start<=indexes[i-1])))throw Error('Invalid screenshot narration boundaries.');
 const sections=story.images.map((image,i)=>({image_id:image.id,text:words.slice(indexes[i],indexes[i+1]??words.length).join(' ')}));
 const next={...story,sections};validateStoryScript(next,script);return next;
}
