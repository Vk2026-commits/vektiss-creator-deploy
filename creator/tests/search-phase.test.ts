import {expect,it} from 'vitest';
import {completedSearchPhase,filteredSearchPhase} from '../src/domain/search-phase';
it('keeps all video completion messages inside the database limit',()=>{
 for(let requested=1;requested<=10;requested++)for(let delivered=0;delivered<=requested;delivered++)for(let round=1;round<=3;round++){
  for(const failed of [undefined,round]){
   const phase=completedSearchPhase(delivered,requested,round,failed);
   expect(phase.length).toBeLessThanOrEqual(120);
   expect(phase).toContain(`${delivered} of ${requested}`);
  }
 }
});

it('settles filtered searches with no relevant matches within the database phase limit',()=>{expect(filteredSearchPhase().length).toBeLessThanOrEqual(120);expect(filteredSearchPhase()).toContain('missing data cannot pass');});
