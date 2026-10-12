import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FreePresenter} from '../src/components/FreePresenter';
import {framingPreviewStyle} from '../src/components/SelectedAvatarOverlay';
import {avatarFramingCrop,customFramingBounds,framedAspect,framingAmount} from '../src/domain/avatar-framing';
import {newVideoPlan,videoPlanSchema} from '../src/domain/video-plan';
import {placementFromLayout,presenterLayout} from '../src/domain/presenter-layout';
import {fullCompositionSchema} from '../server/full-composition';

const baseAspect=720/910;
const baseCrop={x:0,y:186,width:720,height:910};

it('keeps original framing identical to the detected person crop',()=>{
 expect(framedAspect(baseAspect,undefined,undefined)).toBeCloseTo(baseAspect,15);
 expect(framedAspect(baseAspect,'original',70)).toBeCloseTo(baseAspect,15);
 expect(avatarFramingCrop(baseCrop,undefined,undefined)).toEqual(baseCrop);
 expect(avatarFramingCrop(baseCrop,'original',40)).toEqual(baseCrop);
});

it('trims only below the framing preset without changing person width',()=>{
	 expect(framingAmount('head-shoulders',undefined)).toBe(55);
	 expect(avatarFramingCrop(baseCrop,'head-shoulders',undefined)).toEqual({...baseCrop,height:500});
 expect(avatarFramingCrop(baseCrop,'chest-up',undefined)).toEqual({...baseCrop,height:618});
 expect(avatarFramingCrop(baseCrop,'waist-up',undefined)).toEqual({...baseCrop,height:746});
	 expect(avatarFramingCrop(baseCrop,'custom',60)).toEqual({...baseCrop,height:546});
});

it('renders head-and-shoulders as an actual top-of-source crop in the editor',()=>{
 expect(framingPreviewStyle('head-shoulders',undefined)).toMatchObject({width:'auto',height:'181.8181818181818%',position:'absolute',top:0,left:'50%',transform:'translateX(-50%)'});
 expect(framingPreviewStyle('head-shoulders',undefined)).not.toHaveProperty('objectFit','fill');
});

it('scales and anchors the framed person with the same layout math as export',()=>{
 const plan={...newVideoPlan(),presenter_framing:'head-shoulders' as const};
 expect(framedAspect(baseAspect,'head-shoulders',undefined)).toBeCloseTo((720/910)*(100/55));
 const l=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,framedAspect(baseAspect,'head-shoulders',undefined));
 expect(l.width).toBe(216);
 expect(l.x).toBe(252);
 expect(l.y+l.height).toBe(1280);
});

it('round-trips gestures against the framed crop without stretching it',()=>{
 const plan={...newVideoPlan(),presenter_framing:'head-shoulders' as const,presenter_placement:{x:.05,y:.82,width:25}};
 const aspect=framedAspect(baseAspect,'head-shoulders',undefined);
 const layout=presenterLayout(plan.format,plan.presenter_position,plan.presenter_size,plan.presenter_placement,aspect);
 // Export scales the presenter into an even-sized yuv420p overlay; preserve
 // the requested aspect within that pixel-grid quantization.
 expect(layout.width).toBe(180);
 expect(layout.height).toBe(126);
 const idealHeight=layout.width/aspect;
 expect(Math.abs(layout.height-idealHeight)).toBeLessThanOrEqual(1);
 expect(Math.abs(layout.width/layout.height-aspect)).toBeLessThanOrEqual(aspect/layout.height);
 const placement=placementFromLayout(plan,aspect);
 expect(placement.x).toBe(plan.presenter_placement!.x);
 expect(placement.width).toBe(plan.presenter_placement!.width);
 expect(Math.abs(placement.y-plan.presenter_placement!.y)).toBeLessThanOrEqual(.5/layout.h);
});

it('defaults new avatar plans to Head & shoulders and accepts old plans unchanged',()=>{
 const plan=newVideoPlan();
 expect(plan.presenter_framing).toBe('head-shoulders');
 expect(plan.presenter_framing_amount).toBeUndefined();
 const {presenter_framing,presenter_framing_amount,...legacy}=plan;
 void presenter_framing;
 void presenter_framing_amount;
 expect(videoPlanSchema.parse(legacy)).toEqual(legacy);
 expect(videoPlanSchema.safeParse({...legacy,presenter_framing:'chest-up'}).success).toBe(true);
 expect(videoPlanSchema.safeParse({...legacy,presenter_framing:'custom',presenter_framing_amount:29}).success).toBe(false);
 expect(videoPlanSchema.safeParse({...legacy,presenter_framing:'custom',presenter_framing_amount:customFramingBounds.max+1}).success).toBe(false);
});

it('allows optional framing settings in local full-video assembly',()=>{
 const command={job_id:'00000000-0000-4000-8000-000000000001',script_id:'00000000-0000-4000-8000-000000000002',position:'bottom-left',format:'portrait',size:30,placement:{x:.05,y:1,width:30},presenter_only:true};
 expect(fullCompositionSchema.safeParse(command).success).toBe(true);
 expect(fullCompositionSchema.safeParse({...command,presenter_framing:'head-shoulders'}).success).toBe(true);
 expect(fullCompositionSchema.safeParse({...command,presenter_framing:'custom',presenter_framing_amount:45}).success).toBe(true);
 expect(fullCompositionSchema.safeParse({...command,presenter_framing:'head-shoulders',presenter_framing_amount:10}).success).toBe(false);
});

it('exposes framing presets and separates framing from gesture sizing',()=>{
 const plan={...newVideoPlan(),step:'visuals' as const,approved_at:new Date().toISOString(),presenter_framing:'head-shoulders' as const};
 const html=renderToStaticMarkup(<FreePresenter plan={plan} onChange={()=>{}}><div/></FreePresenter>);
 expect(html).toContain('Avatar framing');
 expect(html).toContain('Head &amp; shoulders');
 for(const label of ['Original','Chest up','Waist up','Custom'])expect(html).toContain(label);
 expect(html).toContain('Drag or pinch controls');
});

it('shows the new default and preserves legacy plans without framing',()=>{
 const newHtml=renderToStaticMarkup(<FreePresenter plan={newVideoPlan()} onChange={()=>{}}><div/></FreePresenter>);
 expect(newHtml).toContain('aria-pressed="true">Head &amp; shoulders');
 const {presenter_framing,presenter_framing_amount,...legacy}=newVideoPlan();
 void presenter_framing;
 void presenter_framing_amount;
 const oldHtml=renderToStaticMarkup(<FreePresenter plan={legacy} onChange={()=>{}}><div/></FreePresenter>);
 expect(oldHtml).toContain('aria-pressed="true">Original');
});
