import {it,expect} from 'vitest';
import {alignStory} from '../server/story-alignment';
import {screenshotStorySchema,validateStoryScript} from '../src/domain/screenshot-story';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const story=screenshotStorySchema.parse({version:1,images:ids.map(id=>({id,title:'Screenshot',source_url:''})),sections:[{image_id:ids[0],text:'Stay calm and look around.'},{image_id:ids[1],text:'Now find a safe exit.'}]});
it('aligns transitions to narration including pauses, not equal durations',()=>{
 const words='Stay calm and look around Now find a safe exit'.split(' ').map((word,i)=>({word,start:i<5?i*.3:8+(i-5)*.4,end:i<5?i*.3+.2:8+(i-5)*.4+.3}));
 expect(alignStory(story,words,12)).toEqual([{image_id:ids[0],start:0,end:8},{image_id:ids[1],start:8,end:12}]);
});
it('rejects unrecognized narration rather than guessing',()=>{
 expect(()=>alignStory(story,[{word:'unrelated',start:0,end:1}],12)).toThrow('confidently');
});
it('rejects missing boundary words even with otherwise high coverage',()=>{
 const words='Stay calm and look around find a safe exit'.split(' ').map((word,i)=>({word,start:i,end:i+.5}));
 expect(()=>alignStory(story,words,12)).toThrow('confidently');
});
it('requires matching ordered sections and approved speech',()=>{
 expect(()=>validateStoryScript(story,'Stay calm and look around. Now find a safe exit.')).not.toThrow();
 expect(()=>validateStoryScript(story,'A changed script')).toThrow('approved script');
 expect(screenshotStorySchema.safeParse({...story,sections:[...story.sections].reverse()}).success).toBe(false);
});
it('enforces one through five unique screenshots and legacy optionality',()=>{
 expect(screenshotStorySchema.safeParse({...story,images:[]}).success).toBe(false);
 expect(screenshotStorySchema.safeParse({...story,images:[story.images[0],story.images[0]]}).success).toBe(false);
 expect(screenshotStorySchema.safeParse({...story,images:Array(6).fill(story.images[0])}).success).toBe(false);
});
