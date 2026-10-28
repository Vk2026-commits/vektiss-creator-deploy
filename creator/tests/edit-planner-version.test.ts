import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {editPlannerMessages} from '../server/edit-planner';
import {templateSampleSource} from '../src/domain/edit-template-samples';
it('describes implemented editorial scenes and avoids unsupported earnings comparisons',()=>{
 const messages=editPlannerMessages(templateSampleSource,'popout-explainer').map(m=>m.content).join('\n');
 expect(messages).toContain('single earnings claim must be a statistic');
 expect(messages).toContain('hides all presenter layers');
 expect(messages).toContain('Preserve qualifiers');
});
it('versions client recovery, server plans and provider candidates together',()=>{
 const sources=['src/components/EditStudio.tsx','server/template-edit.ts','supabase/functions/script-assistant/index.ts'].map(p=>readFileSync(p,'utf8'));
 for(const source of sources)expect(source.match(/EDIT_PLANNER_VERSION/g)?.length).toBeGreaterThanOrEqual(2);
});

it('invalidates completed render recovery together with cached MP4s',()=>{
 for(const path of ['src/components/EditStudio.tsx','server/template-render.ts'])expect(readFileSync(path,'utf8').match(/EDIT_RENDER_VERSION/g)?.length).toBeGreaterThanOrEqual(2);
});
