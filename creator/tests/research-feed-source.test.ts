import {expect,it,vi} from 'vitest';
import {filterResearchSource} from '../src/domain/research-feed-source';
it('filters articles before pagination and counting',()=>{
 const q={eq:vi.fn().mockReturnThis(),or:vi.fn().mockReturnThis()};
 expect(filterResearchSource(q,'articles')).toBe(q);
 expect(q.eq).toHaveBeenCalledWith('source_snapshot->0->>sourceType','article');
});
it('keeps legacy videos without a type while excluding articles',()=>{
 const q={eq:vi.fn().mockReturnThis(),or:vi.fn().mockReturnThis()};
 filterResearchSource(q,'videos');
 expect(q.or).toHaveBeenCalledWith('source_snapshot->0->>sourceType.neq.article,source_snapshot->0->>sourceType.is.null');
});
it('does not restrict the combined library',()=>{
 const q={eq:vi.fn(),or:vi.fn()};
 expect(filterResearchSource(q,'all')).toBe(q);
 expect(q.eq).not.toHaveBeenCalled();expect(q.or).not.toHaveBeenCalled();
});
