import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinishedVideoPlayer,playbackTime} from '../src/components/FinishedVideo';
describe('finished video timeline',()=>{
 it('always provides a labelled seek bar outside native video controls',()=>{
  const html=renderToStaticMarkup(<FinishedVideoPlayer src="blob:finished"/>);
  expect(html).toContain('type="range"');
  expect(html).toContain('aria-label="Video playback position"');
  expect(html).toContain('Scrub video');
  expect(html).toContain('disabled=""');
  expect(html).toContain('controls=""');
 });
 it('formats timestamps and unknown durations safely',()=>{
  expect(playbackTime(65.9)).toBe('1:05');
  expect(playbackTime(0)).toBe('0:00');
  expect(playbackTime(Infinity)).toBe('0:00');
  expect(playbackTime(NaN)).toBe('0:00');
 });
});
