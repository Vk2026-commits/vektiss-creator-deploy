import type {ScriptBrief} from './script-brief';
export const videoSteps=['Add your source','Review your script','Choose the look','Create & download'] as const;
export function videoStep(brief:ScriptBrief,planning:boolean){
 if(planning&&brief.production)return ['review','saved'].includes(brief.production.step)?4:3;
 return brief.stage==='source'?1:2;
}
