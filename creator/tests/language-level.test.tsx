import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {LanguageLevelSelect} from '../src/components/LanguageLevelSelect';
import {languageLevelInstruction,resolveLanguageLevel,languageRevisionRequest} from '../src/domain/language-level';
import {briefSchema,emptyBrief} from '../src/domain/script-brief';
import {strategySchema,emptyContent} from '../src/domain/strategy';
describe('language levels',()=>{
 it('preserves compatibility and isolates profile defaults from overrides',()=>{
 expect(resolveLanguageLevel(undefined,undefined)).toBeUndefined();
 expect(languageLevelInstruction()).toBe('');
 expect(resolveLanguageLevel(undefined,'simple')).toBe('simple');
 expect(resolveLanguageLevel('technical','simple')).toBe('technical');
 expect(strategySchema.parse({...emptyContent.strategy,language_level:'simple'}).language_level).toBe('simple');
 expect(briefSchema.parse({...emptyBrief(),language_level:'technical'}).language_level).toBe('technical');
 expect(()=>briefSchema.parse({...emptyBrief(),language_level:'fake'})).toThrow();
 });
 it('uses distinct directions while preserving evidence and exact offers',()=>{
 const simple=languageLevelInstruction('simple'),technical=languageLevelInstruction('technical');
 expect(simple).toContain('fifth-grade');expect(simple).toContain('never childish');
 expect(technical).toContain('precise terminology');expect(technical).toContain('invent expertise');
 for(const text of [simple,technical]){expect(text).toContain('factual qualifications');expect(text).toContain('exact-wording');expect(text).toContain('current revision_request take precedence');}
 expect(languageRevisionRequest('simple')).toContain('Keep the current topic');
 });
 it('renders all options and a separate inherited state',()=>{
 const html=renderToStaticMarkup(<LanguageLevelSelect value="simple" onChange={()=>{}} defaultLabel="Use profile"/>);
 expect(html).toContain('Use profile');expect(html).toContain('value="simple" selected');expect(html).toContain('Technical');
 });
});
