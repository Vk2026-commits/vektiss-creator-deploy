import {describe,it,expect} from 'vitest';
import {editorialAsset,editorialAssetIds} from '../src/domain/editorial-assets';

describe('editorial asset catalogue',()=>{
 it('provides distinct layered illustrations for source tasks and concepts',()=>{
  for(const id of ['cooking','cleaning','repair','video','ai','learning','money','document','idea'] as const){
   const svg=editorialAsset('neutral label',12,18,110,id);
   expect(svg).toContain(`data-editorial-asset="${id}"`);
   expect(svg).toContain('data-editorial-detail="layered"');
   expect(svg).toContain('viewBox="0 0 48 48"');
   expect(svg).toContain('width="110"');
   expect(svg).not.toMatch(/<image|<video|https?:|<text/);
  }
 });
 it('keeps all existing asset ids usable and selects explicit meaning over label keywords',()=>{
  for(const id of editorialAssetIds)expect(editorialAsset('neutral',0,0,80,id)).toContain(`data-editorial-asset="${id}"`);
  expect(editorialAsset('record cooking',0,0,80,'video')).toContain('data-editorial-asset="video"');
  expect(editorialAsset('record cooking',0,0,80)).toContain('data-editorial-asset="cooking"');
  expect(editorialAsset('<script>alert(1)</script>',0,0,80)).not.toContain('<script>');
  expect(editorialAsset('unmatched',0,0,80)).toBe('');
 });
});
