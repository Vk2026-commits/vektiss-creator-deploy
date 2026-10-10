import { expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { newVideoPlan,planReady,videoPlanSchema } from '../src/domain/video-plan';
import { VideoPlan } from '../src/components/VideoPlan';
import { FinishedVideo } from '../src/components/FinishedVideo';
import { scriptSchema } from '../src/domain/scripts';
const script=scriptSchema.parse({content_profile_id:'profile',title:'Test',hook:'A hook',body:'A clear message.',cta:'Save this.'});
const props={script,preview:true,busy:false,onChange:()=>{},onSave:()=>{},onEdit:()=>{}};
it('keeps presenter selection and placement visible for video sources',()=>{
 const html=renderToStaticMarkup(<VideoPlan {...props} script={{...script,brief:{...script.brief,kind:'video'}}} plan={{...newVideoPlan(),step:'visuals',presenter_size:65}}/>);
 expect(html).toContain('presenter-picker');
 expect(html).not.toContain('<summary>Presenter:');
 for(const position of ['Bottom left','Bottom middle','Bottom right'])expect(html).toContain(position);
 expect(html).toContain('Pinch to resize');
 expect(html).toContain('width:30%');
 expect(html).toContain('Small overlay');
 expect(html).not.toContain('Capture article screenshot');
});
it('loads older plans with a safe presenter placement default',()=>{
 const {presenter_position,...older}=newVideoPlan();
 expect(videoPlanSchema.parse(older).presenter_position).toBe('bottom-right');
 expect(videoPlanSchema.safeParse({...older,presenter_position:'top-center'}).success).toBe(false);
});
it('shows gesture controls and clearly labels the screenshot preview boundary',()=>{
 const html=renderToStaticMarkup(<VideoPlan {...props} plan={{...newVideoPlan(),step:'visuals'}}/>);
 for(const position of ['Bottom left','Bottom middle','Bottom right'])expect(html).toContain(position);
 expect(html).toContain('Capture article screenshot');
 expect(html).toContain('Preview a mobile screenshot');
 expect(html).toContain('No background selected. This will be an avatar-only video.');
});
it('assembles an actual MP4 rather than labeling the raw presenter as MP4',()=>{
 const html=renderToStaticMarkup(<FinishedVideo jobId="job" scriptId="script" plan={newVideoPlan()} rawVideoUrl="https://video.example.com/presenter.mp4"/>);
 expect(html).not.toContain('https://video.example.com/presenter.mp4');
 expect(html).toContain('Opening your video…');
 expect(html).not.toContain('85%');
});
it('starts with explicit script approval',()=>{
 const plan=newVideoPlan();expect(planReady(plan)).toBe(false);
 const html=renderToStaticMarkup(<VideoPlan {...props} plan={plan}/>);
 expect(html).toContain('Approve &amp; choose presenter');expect(html).toContain('A clear message.');
});
it('requires an avatar when avatar presentation is chosen',()=>{
 const plan={...newVideoPlan(),approved_at:new Date().toISOString(),presenter:'avatar' as const};
 expect(planReady(plan)).toBe(false);expect(planReady({...plan,avatar_id:'avatar-id'})).toBe(true);
});
it('persists the complete plan through script validation',()=>{
 const plan={...newVideoPlan(),step:'saved' as const,approved_at:new Date().toISOString(),visual_notes:'Highlight the takeaway.'};
 const saved=scriptSchema.parse({...script,brief:{...script.brief,production:plan}});
 expect(saved.brief.production).toEqual(plan);
});
it('makes the rendering boundary explicit on the next screen',()=>{
 const html=renderToStaticMarkup(<VideoPlan {...props} plan={{...newVideoPlan(),step:'review',approved_at:new Date().toISOString()}}/>);
 expect(html).toContain('Save layout &amp; continue');expect(html).toContain('does not start a paid render');expect(html).not.toContain('Full video assembly is not available yet');
});
it('rejects oversized visual instructions',()=>{
 expect(videoPlanSchema.safeParse({...newVideoPlan(),visual_notes:'x'.repeat(4001)}).success).toBe(false);
});
