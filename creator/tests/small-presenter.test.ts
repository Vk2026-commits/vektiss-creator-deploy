import {it,expect} from 'vitest';
import {personBounds} from '../src/domain/person-bounds';
import {newVideoPlan,videoPlanSchema} from '../src/domain/video-plan';
import {presenterLayout,placementFromLayout} from '../src/domain/presenter-layout';
it('starts new projects at 30% while keeping old saved layouts unchanged',()=>{
 const plan=newVideoPlan();expect(plan.presenter_size).toBe(30);
 expect(plan.presenter_sizing).toBe('visible-person-v1');
 const {presenter_sizing,...old}=plan;
 const saved={...old,presenter_size:88,presenter_placement:{x:.68,y:1,width:88}};
 expect(videoPlanSchema.parse(saved)).toEqual(saved);
});
it('measures the person, not transparent margins, including visible hands',()=>{
 const rgba=new Uint8Array(10*12*4);
 for(let y=3;y<11;y++)for(let x=2;x<7;x++)rgba[(y*10+x)*4+3]=255;
 rgba[(7*10+8)*4+3]=255;
 rgba[3]=8;
 expect(personBounds(rgba,10,12)).toEqual({x:2,y:3,width:7,height:8});
 expect(()=>personBounds(new Uint8Array(16),2,2)).toThrow('Empty');
});
it('uses the same visible width and bottom anchor across preview and export aspect ratios',()=>{
 const p=newVideoPlan();
 for(const aspect of [.5,.8,1]){
  const layout=presenterLayout(p.format,p.presenter_position,p.presenter_size,p.presenter_placement,aspect);
  expect(layout.width).toBe(216);expect(layout.y+layout.height).toBe(1280);
  expect(placementFromLayout(p,aspect)).toEqual(p.presenter_placement);
 }
});
