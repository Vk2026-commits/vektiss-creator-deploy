import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ScreenshotStory} from '../src/components/ScreenshotStory';
import {StoryScriptReview} from '../src/components/StoryScriptReview';
import {screenshotStorySchema} from '../src/domain/screenshot-story';
vi.mock('../src/components/GraphicPreview',()=>({GraphicImage:({id}:{id:string})=><img alt="Selected screenshot" src={`/fixture/${id}.png`}/>}));
const story=screenshotStorySchema.parse({version:1,images:[1,2].map(n=>({id:`${n}1111111-1111-4111-8111-111111111111`,title:`Image ${n}`,source_url:''})),sections:[]});
it('shows numbered previews with accessible ordering and no avatar generation action',()=>{
 const html=renderToStaticMarkup(<ScreenshotStory files={[]} initial={story} notes="Explain the news" profileId="profile" scope="fixture" onProcessing={()=>{}} onSave={()=>{}} onComplete={async()=>{}} onCancel={()=>{}}/>);
 for(const text of ['Screenshot 1','Screenshot 2','Move screenshot 1 later','Move screenshot 2 earlier','Remove','Context (optional)','Explain the news','Create my story script'])expect(html).toContain(text);
 expect(html).not.toContain('Generate avatar');
});
it('reviews editable narration beside its linked screenshot',()=>{
 const linked={...story,sections:story.images.map((image,i)=>({image_id:image.id,text:`Passage ${i+1}`}))};
 const html=renderToStaticMarkup(<StoryScriptReview story={linked} editing onChange={()=>{}}/>);
 expect(html.match(/<textarea/g)).toHaveLength(2);expect(html).toContain('Passage 1');expect(html).toContain('Passage 2');
});
