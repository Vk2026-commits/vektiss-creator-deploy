import {GraphicImage} from './GraphicPreview';
import type {ScreenshotStory} from '../domain/screenshot-story';
export function StoryScriptReview({story,editing,onChange}:{story:ScreenshotStory;editing:boolean;onChange:(story:ScreenshotStory)=>void}){
 return <ol className="story-images story-script-review">{story.sections.map((section,i)=><li key={section.image_id}><strong>Screenshot {i+1}</strong><GraphicImage id={section.image_id}/>{editing?<label>What your avatar says<textarea rows={5} maxLength={12000} value={section.text} onChange={e=>{const sections=story.sections.map((s,index)=>index===i?{...s,text:e.target.value}:s);if(sections.map(s=>s.text).join('\n\n').length<=15000)onChange({...story,sections});}}/></label>:<p>{section.text}</p>}</li>)}</ol>;
}
