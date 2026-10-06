import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {InlineClip} from '../src/components/Discover';
describe('Discover playback',()=>{
 for(const platform of ['TikTok','YouTube','Instagram'] as const){
  it(`${platform} exposes the native play button without an intercepting overlay`,()=>{
   const html=renderToStaticMarkup(<InlineClip embed={{platform,src:'https://example.com/embed/123'}} title="Test clip" sourceUrl="https://example.com/post"/>);
   expect(html).toContain('<iframe');
   expect(html).not.toContain('<button');
   expect(html).toContain('autoplay=0');
   if(platform==='TikTok')expect(html).toContain('muted=0');
   if(platform==='YouTube')expect(html).toContain('mute=0');
  });
 }
});
