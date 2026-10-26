import {describe,it,expect} from 'vitest';
import {editTemplates,validateEditProposal} from '../src/domain/edit-templates';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
describe('template gallery samples',()=>{for(const t of editTemplates)it(`${t.id} uses valid five-second export data`,()=>{const plan=templateSample(t.id);expect(validateEditProposal(plan,templateSampleSource,t.id)).toEqual(plan);expect(templateSampleSource.duration).toBe(5);expect(templateSampleSource.words.at(-1)?.end).toBe(5);});});
