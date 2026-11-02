import {expect,it} from 'vitest';
import {fastClipCandidates} from '../src/domain/fast-discovery';
import {providerResearchCandidateSchema} from '../src/domain/research';
const source:any={providerSourceId:1,title:'Recorded intervention',snippet:'Source caption',url:'https://www.tiktok.com/@test/video/123',publishedAt:null,sourceType:'tiktok-native'};
it('returns source text immediately without invented AI ranking or angle',()=>{
 const [c]=fastClipCandidates([source],{visibleActionOnly:false} as any);
 expect(c.title).toBe(source.title);expect(c.relevanceScore).toBe(0);expect(c.category).toBe('Search result');
 expect(providerResearchCandidateSchema.safeParse(c).success).toBe(true);
});
it('requires sampled visual action when the action filter is enabled',()=>{
 const brief:any={visibleActionOnly:true};
 expect(fastClipCandidates([source],brief)).toHaveLength(0);
 expect(fastClipCandidates([{...source,review:{level:'video_sampled',observations:'No physical action is shown.'}}],brief)).toHaveLength(0);
 expect(fastClipCandidates([{...source,review:{level:'video_sampled',observations:'Two people push each other during a confrontation.'}}],brief)).toHaveLength(1);
 expect(fastClipCandidates([{...source,title:'Storytime',review:{level:'video_sampled',observations:'Talking head describes an incident.'}}],brief)).toHaveLength(0);
});
