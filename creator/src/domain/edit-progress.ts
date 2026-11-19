export type EditProgress={stage:'planning'|'illustrating'|'preparing'|'separating'|'rendering'|'finishing'|'audio'|'checking'|'loading';percent?:number;activity?:string};
export type MediaJobProgress={created?:string;progress?:EditProgress};
export const editStageLabels={planning:'Building your edit plan',illustrating:'Creating AI illustrations',preparing:'Preparing video',separating:'Separating presenter',rendering:'Rendering video',finishing:'Finishing your video',audio:'Adding your original audio',checking:'Checking your finished video',loading:'Loading your finished video'};
export function parseEditProgress(line:string):EditProgress|null{
 try{const p=JSON.parse(line);if(!Object.hasOwn(editStageLabels,p.stage))return null;return {stage:p.stage,...(typeof p.percent==='number'&&Number.isFinite(p.percent)?{percent:Math.max(0,Math.min(100,Math.floor(p.percent)))}:{})};}catch{return null;}
}

export const exportSteps=[
 {id:'preparing',label:'Prepare'}, {id:'rendering',label:'Render'},
 {id:'audio',label:'Add audio'}, {id:'checking',label:'Check'}, {id:'loading',label:'Ready to watch'},
] as const;
export function exportStepIndex(stage:EditProgress['stage']){
 if(stage==='separating'||stage==='illustrating')return 0;
 if(stage==='finishing')return 2;
 return Math.max(0,exportSteps.findIndex(step=>step.id===stage));
}
export function exportStageDetail(stage:EditProgress['stage']){
 switch(stage){
 case 'preparing':return 'Loading your saved footage, graphics, and captions.';
 case 'separating':return 'Separating the presenter from the background. This step can take longer.';
 case 'rendering':return 'Building the video frames. The percentage measures this stage, not time remaining.';
 case 'audio':return 'Keeping your original voice and matching it to the finished frames.';
 case 'checking':return 'Checking picture size, duration, and audio before saving your MP4.';
 case 'loading':return 'Your export is saved. Loading it here for playback and download.';
 case 'illustrating':return 'Progress counts completed images. Each image can take a minute or more.';
 default:return 'Finishing the video before checking and saving it.';
 }
}
