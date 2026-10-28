import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {editResponseFormat,normalizeEditResponse} from '../src/domain/edit-response-format';
import {templateSample,templateSampleSource} from '../src/domain/edit-template-samples';
import {validateEditProposal} from '../src/domain/edit-templates';
it('requires exact version, selected style, source revision and every timing/visual field',()=>{
 const format=editResponseFormat(templateSampleSource,'hyperframes-motion');
 expect(format.json_schema.strict).toBe(true);
 const schema=format.json_schema.schema as any;
 expect(schema.properties.version.enum).toEqual([1]);
 expect(schema.properties.templateId.enum).toEqual(['hyperframes-motion']);
 expect(schema.properties.sourceRevision.enum).toEqual([templateSampleSource.revision]);
 const beat=schema.properties.beats.items;
 expect(beat.required).toEqual(expect.arrayContaining(['firstWord','lastWord','visual','purpose']));
 expect(beat.properties.visual.enum).not.toContain('animated-card');
 expect(beat.properties.purpose.minLength).toBe(1);
 const visit=(s:any)=>{if(s.type==='object'){expect(s.additionalProperties).toBe(false);expect(s.required).toEqual(Object.keys(s.properties));Object.values(s.properties).forEach(visit);}if(s.items)visit(s.items);s.anyOf?.forEach(visit);};visit(schema);
});
it('normalizes nullable optional fields without changing speech coverage or hiding invalid fields',()=>{
 const plan=templateSample('hyperframes-motion');
 const wire={...plan,beats:plan.beats.map(b=>({...b,graphics:{...b.graphics,nodes:b.graphics!.nodes.map(n=>({...n,asset:n.asset??null,tier:n.tier??null,revealWord:n.revealWord??null}))}}))};
 expect(validateEditProposal(normalizeEditResponse(wire),templateSampleSource,plan.templateId)).toEqual(plan);
 expect(()=>validateEditProposal(normalizeEditResponse({...wire,version:2}),templateSampleSource,plan.templateId)).toThrow();
});
it('wires the enforced schema into the deployed edit planner',()=>{
 const code=readFileSync(new URL('../supabase/functions/script-assistant/index.ts',import.meta.url),'utf8');
 expect(code).toContain('response_format:editResponseFormat(source,template)');
 expect(code).toContain('editProposalSchema.parse(normalizeEditResponse(');
});

it('allows only supported illustration IDs and preserves a semantic selection',()=>{
 const plan=templateSample('popout-explainer');
 plan.beats[0].graphics!.nodes[0].asset='security';
 expect(validateEditProposal(plan,templateSampleSource,plan.templateId).beats[0].graphics!.nodes[0].asset).toBe('security');
 const invalid=JSON.parse(JSON.stringify(plan));invalid.beats[0].graphics.nodes[0].asset='https://untrusted.example/image.svg';
 expect(()=>validateEditProposal(invalid,templateSampleSource,plan.templateId)).toThrow();
});
