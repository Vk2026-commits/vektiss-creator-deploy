import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {editPlannerMessages,editPlannerModel} from '../server/edit-planner';
import {templateSampleSource} from '../src/domain/edit-template-samples';
it('describes implemented editorial scenes and avoids unsupported earnings comparisons',()=>{
 const messages=editPlannerMessages(templateSampleSource,'popout-explainer').map(m=>m.content).join('\n');
 expect(messages).toContain('single earnings claim must be a statistic');
 expect(messages).toContain('protected caption band');
 expect(messages).toContain('Preserve qualifiers');
});
it('versions client recovery, server plans and provider candidates together',()=>{
 const sources=['src/components/EditStudio.tsx','server/template-edit.ts','supabase/functions/script-assistant/index.ts'].map(p=>readFileSync(p,'utf8'));
 for(const source of sources)expect(source.match(/EDIT_PLANNER_VERSION/g)?.length).toBeGreaterThanOrEqual(2);
});

it('invalidates completed render recovery together with cached MP4s',()=>{
 for(const path of ['src/components/EditStudio.tsx','server/template-render.ts'])expect(readFileSync(path,'utf8').match(/EDIT_RENDER_VERSION/g)?.length).toBeGreaterThanOrEqual(2);
});

it('gives Pop-out a coherent reference-specific brief instead of generic card instructions',()=>{
 const messages=editPlannerMessages(templateSampleSource,'popout-explainer');
 expect(messages).toHaveLength(2);
 expect(messages[0].content).toContain('Create a complete visual explanation');
 expect(messages[0].content).toContain('Never return an empty statistics scene');
 expect(messages[0].content).toContain('exactly one presenter');
 expect(messages[0].content).toContain('not a real search result');
 expect(messages[0].content).not.toContain('Motion is a deterministic staggered reveal');
});

it('assigns content to directed motion rather than asking AI to invent choreography',()=>{
 const brief=editPlannerMessages(templateSampleSource,'popout-explainer')[0].content;
 expect(brief).toContain('Choreography is implemented by the template');
 expect(brief).toContain('empty panel');
 expect(brief).toContain('Do not automatically speed up speech');
});

it('uses the validated planning model for Pop-out without changing other styles',()=>{
 expect(editPlannerModel('popout-explainer')).toBe('gpt-4.1-2025-04-14');
 expect(editPlannerModel('glass-cards')).toBe('gpt-4o-mini');
 expect(readFileSync('supabase/functions/script-assistant/index.ts','utf8')).toContain("editing?editPlannerModel(form?.get('template'))");
});
