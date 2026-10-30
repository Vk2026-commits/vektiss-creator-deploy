import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Discover} from '../src/components/Discover';
import {emptyContent,type ContentProfile} from '../src/domain/strategy';

const profile=(id:string,name:string):ContentProfile=>({
  ...emptyContent,id,name,primary_audience:'People interested in '+name,
  user_id:'creator-1',creator_profile_id:'creator-1',archived_at:null,updated_at:'2026-10-17T00:00:00Z',
});

describe('Discover profile selection',()=>{
  it('shows the selected profile beside the search controls',()=>{
    const html=renderToStaticMarkup(<Discover profiles={[profile('safety','Safety with Steve'),profile('credit','Credit with Rose')]} selectedId="safety" onSelectProfile={()=>{}} onCreate={()=>{}}/>);
    expect(html).toContain('Searching with this Content Profile');
    expect(html).toContain('What do you want to find?');
    expect(html.indexOf('id="discover-query"')).toBeLessThan(html.indexOf('discover-profile-choice'));
    expect(html).toContain('Rank for my content profile');
    expect(html).toContain('Add keyword');
    expect(html).toContain('Search ·');
    expect(html).toContain('<option value="safety" selected="">Safety with Steve</option>');
    expect(html).toContain('<option value="credit">Credit with Rose</option>');
    expect(html).toContain('Search videos. Find your next idea.');
    expect(html).toContain('<summary>Content profile: Safety with Steve</summary>');
    expect(html.match(/class="discover-primary-find"/g)).toHaveLength(1);
  });

  it('does not offer archived profiles as search targets',()=>{
    const archived={...profile('old','Old audience'),archived_at:'2026-10-16T00:00:00Z'};
    const html=renderToStaticMarkup(<Discover profiles={[profile('safety','Safety with Steve'),archived]} selectedId="safety" onSelectProfile={()=>{}} onCreate={()=>{}}/>);
    expect(html).not.toContain('Old audience');
  });
});
