import {it,expect} from 'vitest';
import {rankingRenderWorkers} from '../render/render-workers.mjs';
const job={preview:false,proposal:{templateId:'tier-list'}};
const roomy={cores:4,memory:4*1024**3,cpuMax:'max 100000',memoryMax:'max',memoryUsed:'0',requested:'2'};
it('uses two workers for ranking exports with headroom, and honors rollback',()=>{
 expect(rankingRenderWorkers(job,roomy)).toBe(2);
 expect(rankingRenderWorkers(job,{...roomy,requested:'1'})).toBe(1);
});
it('protects previews, matte templates and constrained containers',()=>{
 expect(rankingRenderWorkers({...job,preview:true},roomy)).toBe(1);
 expect(rankingRenderWorkers({proposal:{templateId:'paper-cutout'}},roomy)).toBe(1);
 for(const limits of [{cores:1},{memory:512*1024**2},{cpuMax:'100000 100000'},{memoryMax:String(2*1024**3),memoryUsed:String(1.5*1024**3)}])expect(rankingRenderWorkers(job,{...roomy,...limits})).toBe(1);
});
