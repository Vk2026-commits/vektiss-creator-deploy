import {describe,expect,it} from 'vitest';
import {appendResearchEvidence} from '../src/domain/research-evidence';

const source={
  providerSourceId:44,
  title:'Persistent agents for teams',
  url:'https://example.com/article',
  snippet:'The article says persistent agents can monitor recurring work and return completed work for human approval.',
  publishedAt:'2026-09-29',
  sourceType:'article',
};

describe('appendResearchEvidence',()=>{
 it('adds saved Discover excerpts to a thin visual report',()=>{
  const value=appendResearchEvidence('Visible image text: Persistent agents for teams',[source]);
  expect(value).toContain('Visible image text');
  expect(value).toContain('Discover source 1 (untrusted article excerpt)');
  expect(value).toContain(source.snippet);
 });

 it('leaves ordinary uploads unchanged',()=>{
  expect(appendResearchEvidence('A complete uploaded source report.',undefined)).toBe('A complete uploaded source report.');
 });

 it('keeps the assistant input within the brief limit',()=>{
  const value=appendResearchEvidence('Visual report',[...Array(6)].map((_,index)=>({...source,providerSourceId:index+1,snippet:'x'.repeat(6000)})));
  expect(value.length).toBeLessThanOrEqual(40_000);
 });
});
