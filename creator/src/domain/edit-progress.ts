export type EditProgress={stage:'preparing'|'separating'|'rendering'|'finishing';percent?:number};
export type MediaJobProgress={created?:string;progress?:EditProgress};
export const editStageLabels={preparing:'Preparing video',separating:'Separating presenter',rendering:'Rendering video',finishing:'Finishing and checking export'};
export function parseEditProgress(line:string):EditProgress|null{
 try{const p=JSON.parse(line);if(!Object.hasOwn(editStageLabels,p.stage))return null;return {stage:p.stage,...(typeof p.percent==='number'&&Number.isFinite(p.percent)?{percent:Math.max(0,Math.min(100,Math.floor(p.percent)))}:{})};}catch{return null;}
}
