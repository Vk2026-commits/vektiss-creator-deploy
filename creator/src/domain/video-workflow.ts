import type {ScriptBrief} from './script-brief';
export const videoSteps=['Source','Script','Avatar','Video'] as const;
export function videoStep(brief:ScriptBrief,planning:boolean){
 if(planning&&brief.production)return ['review','saved'].includes(brief.production.step)?4:3;
 return brief.stage==='source'?1:2;
}
