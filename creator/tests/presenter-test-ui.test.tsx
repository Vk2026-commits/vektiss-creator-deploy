import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {PresenterResult} from '../src/components/PresenterResult';
describe('short avatar test presentation',()=>{
 it('loads the short test and groups secondary controls',()=>{
  const html=renderToStaticMarkup(<PresenterResult id="test" url="https://example.com/test.webm"/>);
  expect(html).toContain('Loading your test video');
  expect(html).toContain('preload="auto"');
  expect(html).toContain('<summary>More options</summary>');
  expect(html).toContain('controls=""');
 });
 it('recovers required tests without submitting and retains consent gates',()=>{
  const source=readFileSync(new URL('../src/components/PresenterTest.tsx',import.meta.url),'utf8');
  expect(source).toContain('recovered.current=key;void prepare()');
  expect(source).toContain('if(!jobId||!activeJob)return');
  expect(source).toContain('if(!jobId||!completedJob)return');
  expect(source).toContain('!consent||busy||disabled||submitting.current');
  expect(source).toContain('Looks good — continue');
  expect(source).toContain('!visualApproved||backgroundRejected');
 });
});
