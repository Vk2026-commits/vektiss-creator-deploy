import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Scripts} from '../src/components/Scripts';
import {readFileSync} from 'node:fs';
it('introduces video creation and offers an audience route with no profiles',()=>{
 const html=renderToStaticMarkup(<Scripts profiles={[]} selectedId={null} userId="test" preview onAddAudience={()=>{}}/>);
 expect(html).toContain('<h1>Create video</h1>');
 expect(html).toContain('Who are you talking to?');
 expect(html).toContain('+ Add audience');
});
it('defaults the signed-in home to video creation and keeps the editor mounted on profile navigation',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 expect(app).toContain('useState<Page>("create")');
 expect(app).toContain("hidden={page !== 'create'}");
 expect(app).toContain("setPage('profiles')");
 expect(app).toContain('Use this audience');
 const nav=app.split('<nav aria-label="Main navigation">')[1].split('</nav>')[0];
 expect(nav.indexOf('My videos')).toBeLessThan(nav.indexOf('Content Profiles'));
});
