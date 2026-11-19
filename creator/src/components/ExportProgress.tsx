import {editStageLabels,exportSteps,exportStepIndex,exportStageDetail,type EditProgress} from '../domain/edit-progress';
export function ExportProgress({progress,elapsed}:{progress:EditProgress;elapsed:number}){
 return <div className="edit-render-progress" role="status" aria-live="polite">
    <strong>{editStageLabels[progress.stage]}{progress.percent!==undefined?` · ${progress.percent}% of this stage`:''}</strong>
    {progress.stage!=='illustrating'&&<ol className="edit-export-steps" aria-label="Export stages">{exportSteps.map((stage,i)=><li key={stage.id} aria-current={i===exportStepIndex(progress.stage)?'step':undefined} className={i<exportStepIndex(progress.stage)?'is-done':''}>{i<exportStepIndex(progress.stage)?'✓':i+1}. {stage.label}</li>)}</ol>}
    <progress aria-label={editStageLabels[progress.stage]} max={100} value={progress.percent}/><span role="timer" aria-live="off">Elapsed {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
    <p>{exportStageDetail(progress.stage)}</p>{elapsed>=120&&progress.stage!=='loading'&&<p>Longer videos can take several minutes. Your source is saved; you do not need to start again.</p>}
   </div>;
}
