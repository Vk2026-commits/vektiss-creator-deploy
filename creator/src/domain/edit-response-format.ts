import {editTemplateId,editSourceSchema,type EditSource} from './edit-templates.ts';

/** Strict provider schema. Semantic speech coverage is still validated separately. */
export function editResponseFormat(rawSource:EditSource,template:unknown){
 const source=editSourceSchema.parse(rawSource);
 const styles=template==='recommend'?editTemplateId.options:[editTemplateId.parse(template)];
 const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 const text=(maxLength:number,minLength=0)=>({type:'string',minLength,maxLength});
 const enumeration=(values:readonly unknown[])=>({type:'string',enum:values});
 const word={type:'integer',minimum:0,maximum:source.words.length-1};
 const node=object({label:text(45,1),shape:enumeration(['box','circle']),x:{type:'number',minimum:10,maximum:90},y:{type:'number',minimum:15,maximum:85},tier:{anyOf:[enumeration(['S','A','B','C','D','E','F']),{type:'null'}]},revealWord:{anyOf:[word,{type:'null'}]}});
 const beat=object({
  scene:enumeration(['process','timeline','comparison','network','statistic','document','spotlight']),
  firstWord:word,lastWord:word,
  layout:enumeration(['presenter','bottom-presenter','split','full-graphic']),
  visual:enumeration(['presenter','diagram','comparison','steps','typography','tier-board','screen-focus']),
  headline:text(100),purpose:text(600,1),illustration:text(1200),motion:text(600),
  graphics:object({chart:{anyOf:[object({unit:text(30),items:{type:'array',minItems:2,maxItems:4,items:object({label:text(45,1),value:{type:'number',minimum:0,maximum:1e15},sourceWord:word})}}),{type:'null'}]},nodes:{type:'array',items:node,maxItems:6},links:{type:'array',maxItems:8,items:object({from:{type:'integer',minimum:0,maximum:5},to:{type:'integer',minimum:0,maximum:5}})}}),
 });
 return {type:'json_schema',json_schema:{name:'creator_edit_plan',strict:true,schema:object({version:{type:'integer',enum:[1]},rendererVersion:{type:'integer',enum:[2]},templateId:enumeration(styles),sourceRevision:enumeration([source.revision]),beats:{type:'array',minItems:1,maxItems:100,items:beat}})}};
}

/** Null means absent in the wire format, not a fabricated tier or word anchor. */
export function normalizeEditResponse(raw:unknown):unknown{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
 const plan=raw as Record<string,unknown>;
 if(!Array.isArray(plan.beats))return raw;
 return {...plan,beats:plan.beats.map(beat=>{
  if(!beat||typeof beat!=='object'||!beat.graphics||!Array.isArray(beat.graphics.nodes))return beat;
  const graphics={...beat.graphics};if(graphics.chart===null)delete graphics.chart;
  return {...beat,graphics:{...graphics,nodes:beat.graphics.nodes.map((node:Record<string,unknown>)=>{
   if(!node||typeof node!=='object')return node;
   const result={...node};if(result.tier===null)delete result.tier;if(result.revealWord===null)delete result.revealWord;return result;
  })}};
 })};
}
