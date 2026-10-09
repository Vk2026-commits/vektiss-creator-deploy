import {it,expect} from 'vitest';
import {briefSchema,emptyBrief} from '../src/domain/script-brief';
import {newVideoPlan,videoPlanSchema} from '../src/domain/video-plan';
import {screenshotStorySchema,validateStoryScript,storyRevisionInput} from '../src/domain/screenshot-story';
const id='11111111-1111-4111-8111-111111111111';
it('preserves old single-source briefs and plans unchanged',()=>{
 const brief=emptyBrief(),plan=newVideoPlan();
 expect(briefSchema.parse(brief)).toEqual(brief);
 expect(videoPlanSchema.parse(plan)).toEqual(plan);
});
it('round trips story evidence independently of creative direction',()=>{
 const story=screenshotStorySchema.parse({version:1,images:[{id,title:'News',source_url:'',analysis:'The image claims a new rule.'}],sections:[{image_id:id,text:'Here is what this means.'}]});
 const brief=briefSchema.parse({...emptyBrief(),notes:'Focus on practical steps.',screenshot_story:story});
 expect(brief.screenshot_story).toEqual(story);expect(brief.notes).toBe('Focus on practical steps.');
 expect(videoPlanSchema.parse({...newVideoPlan(),screenshot_story:story}).screenshot_story).toEqual(story);
});
it('accepts pronunciation normalization but does not silently accept edited narration',()=>{
 const story=screenshotStorySchema.parse({version:1,images:[{id,title:'Emergency',source_url:''}],sections:[{image_id:id,text:'Call 911 now.'}]});
 expect(()=>validateStoryScript(story,'Call 9-1-1 now.')).not.toThrow();
 expect(()=>validateStoryScript(story,'Call tomorrow.')).toThrow();
});
it('isolates export revisions from changed narration or image order, not object key order',()=>{
 const story=screenshotStorySchema.parse({version:1,images:[{id,title:'A',source_url:''}],sections:[{image_id:id,text:'One.'}]});
 expect(storyRevisionInput(story)).toBe(storyRevisionInput({...story,images:[{source_url:'',title:'A',id}]}));
 expect(storyRevisionInput(story)).not.toBe(storyRevisionInput({...story,sections:[{image_id:id,text:'Two.'}]}));
 expect(storyRevisionInput(story)).not.toBe(storyRevisionInput({...story,images:[{...story.images[0],id:'22222222-2222-4222-8222-222222222222'}]}));
});
