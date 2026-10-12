import {expect,it} from 'vitest';
import {avatarFramingCrop,presenterBaseCrop} from '../src/domain/avatar-framing';
import {presenterLayout} from '../src/domain/presenter-layout';
it('crops head and shoulders from visible subject bounds, not legacy full-canvas approval',()=>{
 const detected={x:200,y:700,width:320,height:400};
 const crop=avatarFramingCrop(presenterBaseCrop(detected,{x:0,y:0,width:720,height:1280},720,1280),'head-shoulders',undefined);
 expect(crop).toEqual({x:200,y:700,width:320,height:220});
 const layout=presenterLayout('portrait','bottom-center',30,{x:.64,y:.93,width:87},crop.width/crop.height);
 expect(layout.width).toBe(626);
 expect(crop.y+crop.height).toBeLessThan(1000); // tabletop begins below shoulders
});
it('preserves real verified bounds and falls back when verification is absent',()=>{
 const detected={x:200,y:700,width:320,height:400};
 const verified={x:180,y:680,width:360,height:440};
 expect(presenterBaseCrop(detected,verified,720,1280)).toBe(verified);
 expect(presenterBaseCrop(detected,undefined,720,1280)).toBe(detected);
});
