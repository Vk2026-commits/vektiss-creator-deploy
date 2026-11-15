import {describe,it,expect} from 'vitest';
import {articleCandidateTarget,articleRoundDirection} from '../src/domain/article-retrieval';
describe('article retrieval',()=>{
 it('keeps a useful candidate pool even when only one article is missing',()=>{
  expect(articleCandidateTarget(1)).toBe(8);
  expect(articleCandidateTarget(10)).toBe(30);
  expect(articleCandidateTarget(100)).toBe(30);
 });
 it('changes search lanes without changing qualification',()=>{
  const rounds=[1,2,3].map(n=>articleRoundDirection(n,['AI services','jobs','business']));
  expect(new Set(rounds).size).toBe(3);
  expect(rounds[1]).toContain('["jobs","business","AI services"]');
  for(const direction of rounds)expect(direction).toContain('Keep the original dates, publisher policy, relevance threshold, and subject exclusions');
 });
});
