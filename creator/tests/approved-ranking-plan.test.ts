import {it,expect} from 'vitest';
import {approvedRankingPlan} from '../src/domain/approved-ranking-plan';
const project={title:'Two AI services',brief:{avatar_creation:{approved:true,template:'tier-list',items:[{label:'Social posts',rating:'C'},{label:'Lead follow-up',rating:'S'}]}}};
const words=['Social','posts:','C','tier.','Useful.','Lead','follow-up:','S','tier.','Comment','AUDIT.'];
const source={kind:'avatar' as const,assetId:'00000000-0000-4000-8000-000000000001',revision:'abc',duration:words.length,words:words.map((text,i)=>({text,start:i,end:i+1}))};
it('anchors both approved items and retains the whole CTA',()=>{const p=approvedRankingPlan(project,source);expect(p.beats[0].graphics!.nodes.map(n=>[n.label,n.tier,n.introducedWord,n.revealWord])).toEqual([['Social posts','C',0,2],['Lead follow-up','S',5,7]]);expect(p.beats[0].lastWord).toBe(10);});
it('rejects unapproved rankings, changed ratings and order',()=>{expect(()=>approvedRankingPlan({...project,brief:{avatar_creation:{...project.brief.avatar_creation,approved:false}}},source)).toThrow();for(const items of [[{label:'Social posts',rating:'S'}],[...project.brief.avatar_creation.items].reverse()])expect(()=>approvedRankingPlan({...project,brief:{avatar_creation:{...project.brief.avatar_creation,items}}},source)).toThrow();});
it('refuses ambiguous repeated labels rather than guessing',()=>{const repeated={...source,duration:15,words:[...source.words,...source.words.slice(0,4).map((w,i)=>({...w,start:11+i,end:12+i}))]};expect(()=>approvedRankingPlan(project,repeated)).toThrow();});
