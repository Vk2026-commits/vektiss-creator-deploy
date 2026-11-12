import {describe,it,expect} from 'vitest';
import {avatarCreationSchema,avatarBriefSource,rankingScriptError} from '../src/domain/avatar-creation';
import {briefSchema,emptyBrief} from '../src/domain/script-brief';
describe('avatar-first creation',()=>{
 const creation=avatarCreationSchema.parse({template:'tier-list',format:'landscape',topic:'Safety habits',angle:'My practical opinion',approved:true,items:[{label:'Notice exits',rating:'S'},{label:'Ignore surroundings',rating:'F'}]});
 it('restores an original idea without footage or a URL',()=>{
  const brief=briefSchema.parse(JSON.parse(JSON.stringify({...emptyBrief(),avatar_creation:creation,source:avatarBriefSource(creation)})));
  expect(brief.url).toBe('');expect(brief.avatar_creation).toEqual(creation);expect(brief.source).toContain('Notice exits: S');
 });
 it('requires labels, ratings and reveal order before approval',()=>{
  expect(rankingScriptError(creation,'Notice exits earns S tier. Ignore surroundings earns F tier.')).toBeNull();
  expect(rankingScriptError(creation,'Notice exits earns B tier. Ignore surroundings earns F tier.')).not.toBeNull();
  expect(rankingScriptError(creation,'Ignore surroundings earns F. Notice exits earns S.')).not.toBeNull();
 });
 it('does not gate uploads and reaction scripts',()=>expect(rankingScriptError(undefined,'An existing script')).toBeNull());
});
