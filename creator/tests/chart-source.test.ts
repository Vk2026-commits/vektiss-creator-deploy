import {it,expect} from 'vitest';
import {validateEditProposal,type EditSource} from '../src/domain/edit-templates';
import {templateSample} from '../src/domain/edit-template-samples';
import {editResponseFormat,normalizeEditResponse} from '../src/domain/edit-response-format';
const source:EditSource={kind:'upload',assetId:'00000000-0000-4000-8000-000000000001',revision:'chart-source',duration:5,words:['Before','20','hours','after','5','hours'].map((text,i)=>({text,start:i*.5,end:i*.5+.4}))};
function proposal(){const p=templateSample('charts-comparisons');p.sourceRevision=source.revision;p.beats[0].lastWord=5;p.beats[0].graphics!.nodes=[];p.beats[0].graphics!.chart={unit:'hours',items:[{label:'Before',value:20,sourceWord:1},{label:'After',value:5,sourceWord:4}]};return p;}
it('accepts explicit transcript figures and rejects invented magnitudes, units and anchors',()=>{
 const p=proposal();expect(()=>validateEditProposal(p,source,p.templateId)).not.toThrow();
 p.beats[0].graphics!.chart!.items[0].value=200;expect(()=>validateEditProposal(p,source,p.templateId)).toThrow('EDIT_CHART_SOURCE');
 p.beats[0].graphics!.chart!.items[0].value=20;p.beats[0].graphics!.chart!.unit='dollars';expect(()=>validateEditProposal(p,source,p.templateId)).toThrow('EDIT_CHART_UNIT');
 p.beats[0].graphics!.chart!.unit='hours';p.beats[0].graphics!.chart!.items[0].sourceWord=99;expect(()=>validateEditProposal(p,source,p.templateId)).toThrow('EDIT_CHART_SOURCE');
});
it('wire format allows a null chart and normalizes it away',()=>{
 const p=proposal();delete p.beats[0].graphics!.chart;
 const wire={...p,beats:p.beats.map(b=>({...b,graphics:{...b.graphics,chart:null}}))};
 expect(normalizeEditResponse(wire)).toEqual(p);
 const schema=editResponseFormat(source,'charts-comparisons').json_schema.schema as any;
 expect(schema.properties.beats.items.properties.graphics.required).toContain('chart');
});
