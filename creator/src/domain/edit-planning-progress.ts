/** Percent is completed workflow checkpoints, never a forecast of time remaining. */
export const planningSteps=[
 {id:'source',label:'Preparing your recording'},
 {id:'transcription',label:'Reading and timing your speech'},
 {id:'planning',label:'Designing the scenes'},
 {id:'validation',label:'Checking the edit'},
 {id:'saving',label:'Saving your plan'},
] as const;
export type PlanningStep=typeof planningSteps[number]['id'];
export function planningProgress(step:PlanningStep){
 return {stage:'planning' as const,percent:planningSteps.findIndex(s=>s.id===step)*20,activity:planningSteps.find(s=>s.id===step)!.label};
}
