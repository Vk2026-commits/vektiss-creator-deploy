import {describe,it,expect} from 'vitest';
import {resolveArticleWindow,publicationInWindow,articleSearchFilters} from '../src/domain/research-window';
import {researchRequestSchema} from '../src/domain/research';
const now=new Date('2026-10-06T18:00:00Z');
describe('article publication windows',()=>{
 for(const [preset,days]of Object.entries({day:1,week:7,month:30,quarter:90,year:365}))it(preset,()=>{
  const window=resolveArticleWindow({preset:preset as 'day',timezone:'America/Chicago'},now);
  expect(Date.parse(window.end)-Date.parse(window.start)).toBe(days*86400000);
  expect(publicationInWindow(window.start,window)).toBe(true);
  expect(publicationInWindow(new Date(Date.parse(window.start)-1).toISOString(),window)).toBe(false);
 });
 it('resolves local dates across daylight saving changes',()=>{
  const window=resolveArticleWindow({preset:'custom',timezone:'America/Chicago',start:'2026-03-08',end:'2026-03-08'},now);
  expect(window.start).toBe('2026-03-08T06:00:00.000Z');
  expect(window.end).toBe('2026-03-09T04:59:59.999Z');
  expect(publicationInWindow('2026-03-08',window)).toBe(true);
 });
 it('rejects missing, reversed, impossible, old and future dates and bad timezones',()=>{
  for(const [start,end]of [['2026-10-07','2026-10-07'],['2026-10-06','2026-10-05'],['2026-02-30','2026-03-01'],['2024-01-01','2026-01-01'],['','']])expect(()=>resolveArticleWindow({preset:'custom',timezone:'UTC',start,end},now)).toThrow();
  expect(()=>resolveArticleWindow({preset:'week',timezone:'not/a/zone'},now)).toThrow();
 });
 it('excludes unknown and outside publication dates, with immutable bounds',()=>{
  const window=resolveArticleWindow({preset:'week',timezone:'UTC'},now);
  for(const value of [null,'nonsense','2026-01-01','2026-12-01'])expect(publicationInWindow(value,window)).toBe(false);
  expect(articleSearchFilters(window)).toEqual({search_after_date_filter:'09/28/2026',search_before_date_filter:'10/07/2026'});
 });
 it('defaults old requests to videos',()=>{
  expect(researchRequestSchema.parse({profileId:'a9a8ba79-f20c-4090-9c47-67d5c0d7132e',requestedCount:10,idempotencyKey:'a9a8ba79-f20c-4090-9c47-67d5c0d7132e'}).sourceMode).toBe('videos');
  for (const count of [1, 5, 10]) expect(researchRequestSchema.parse({profileId:'a9a8ba79-f20c-4090-9c47-67d5c0d7132e',requestedCount:count,idempotencyKey:'a9a8ba79-f20c-4090-9c47-67d5c0d7132e'}).requestedCount).toBe(count);
  for (const count of [0, 11, 20, 30]) expect(researchRequestSchema.safeParse({profileId:'a9a8ba79-f20c-4090-9c47-67d5c0d7132e',requestedCount:count,idempotencyKey:'a9a8ba79-f20c-4090-9c47-67d5c0d7132e'}).success).toBe(false);
 });
});
