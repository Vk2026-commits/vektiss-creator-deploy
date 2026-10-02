import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ScriptProgress} from '../src/components/ScriptProgress';
it('labels intermediate progress as estimated with an accessible meter',()=>{
 const html=renderToStaticMarkup(<ScriptProgress progress={{percent:85,label:'Writing your script…'}}/>);
 expect(html).toContain('85% estimated');expect(html).toContain('<progress');expect(html).toContain('value="85"');expect(html).toContain('role="status"');
 expect(html).toContain('draft-progress-active');
});
it('shows processing without a fictitious frozen percentage',()=>{
 const html=renderToStaticMarkup(<ScriptProgress progress={{percent:0,label:'Extracting frames',indeterminate:true}}/>);
 expect(html).toContain('Processing…');expect(html).toContain('<progress');expect(html).not.toContain('value="0"');expect(html).not.toContain('0%');
});
it('waits for a cut without showing an active or failed meter',()=>{
 const html=renderToStaticMarkup(<ScriptProgress progress={{percent:0,label:'Check your cut',waiting:true}}/>);
 expect(html).toContain('Your input needed');expect(html).not.toContain('<progress');expect(html).not.toContain('draft-progress-active');expect(html).not.toContain('Retry when');
});
it('shows completion only at 100 and explains a failed attempt',()=>{
 const complete=renderToStaticMarkup(<ScriptProgress progress={{percent:100,label:'Your draft is ready'}}/>);
 expect(complete).not.toContain('estimated');expect(complete).toContain('Ready for your review');
 expect(complete).not.toContain('draft-progress-active');
 const failure=renderToStaticMarkup(<ScriptProgress progress={{percent:85,label:'Please retry',failed:true}}/>);
 expect(failure).toContain('Retry when');expect(failure).not.toContain('We’ll open');
 expect(failure).not.toContain('draft-progress-active');
});
