import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ExportProgress} from '../src/components/ExportProgress';
it('shows measured progress and elapsed time without a fabricated remaining-time estimate',()=>{
 const html=renderToStaticMarkup(<ExportProgress progress={{stage:'rendering',percent:67}} elapsed={173}/>);
 expect(html).toContain('67% of this stage');expect(html).toContain('2:53');
 expect(html).toContain('aria-current="step"');expect(html).toContain('not time remaining');
 expect(html).toContain('Your source is saved');
});
it('keeps non-measured checks indeterminate and identifies playback loading separately',()=>{
 const checking=renderToStaticMarkup(<ExportProgress progress={{stage:'checking'}} elapsed={180}/>);
 expect(checking).toContain('Checking your finished video');expect(checking).not.toContain('value=');
 const loading=renderToStaticMarkup(<ExportProgress progress={{stage:'loading',percent:40}} elapsed={190}/>);
 expect(loading).toContain('Your export is saved');expect(loading).toContain('40% of this stage');
});
