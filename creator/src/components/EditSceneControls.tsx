import {useState} from 'react';
import {removeSceneNode,setSceneVisual,visualChoices,type EditBeat,type VisualChoice} from '../domain/edit-scene-controls';
export function EditSceneControls({beat,busy,onChange}:{beat:EditBeat;busy:boolean;onChange:(beat:EditBeat)=>void}){
 const [label,setLabel]=useState('');
 const presenter=beat.visual==='presenter';
 const limit=beat.scene==='statistic'?3:beat.scene==='comparison'||beat.scene==='document'?4:6;
 return <fieldset disabled={busy}><legend>Visuals for this section</legend>
  <label>Element type<select value={presenter?'presenter':beat.visual==='tier-board'?'tier-board':beat.scene??'network'} onChange={e=>onChange(setSceneVisual(beat,e.target.value as VisualChoice))}>{visualChoices.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}{beat.visual==='tier-board'&&<option value="tier-board">Ranking board</option>}</select></label>
  {!presenter&&<>
   <label>Headline<input maxLength={100} value={beat.headline} onChange={e=>onChange({...beat,headline:e.target.value})}/></label>
   <label>Presenter placement<select value={beat.layout} onChange={e=>onChange({...beat,layout:e.target.value as EditBeat['layout']})}><option value="bottom-presenter">Presenter alongside graphics</option><option value="full-graphic">Full-screen graphic</option>{beat.layout==='split'&&<option value="split">Split</option>}</select></label>
   {beat.visual==='tier-board'&&<p>Existing rankings are preserved. Changing the element type replaces the ranking board.</p>}
   {beat.graphics?.nodes.map((node,index)=><div key={index}><label>Element {index+1}<input required maxLength={45} value={node.label} onChange={e=>onChange({...beat,graphics:{...beat.graphics!,nodes:beat.graphics!.nodes.map((n,i)=>i===index?{...n,label:e.target.value}:n)}})}/></label><button type="button" className="button" onClick={()=>onChange(removeSceneNode(beat,index))}>Remove element {index+1}</button></div>)}
   {beat.visual!=='tier-board'&&(beat.graphics?.nodes.length??0)<limit&&<div><label>New element text<input maxLength={45} value={label} onChange={e=>setLabel(e.target.value)}/></label><button type="button" className="button" disabled={!label.trim()} onClick={()=>{onChange({...beat,graphics:{nodes:[...(beat.graphics?.nodes??[]),{label:label.trim(),shape:'box',x:50,y:50}],links:beat.graphics?.links??[]}});setLabel('');}}>Add element</button></div>}
   {!beat.graphics?.nodes.length&&<p role="status">Add your first element before saving. Use only claims and numbers supported by your source.</p>}
   <button type="button" className="button" onClick={()=>onChange(setSceneVisual(beat,'presenter'))}>Remove graphics · presenter only</button>
  </>}
  <p>Manual changes do not call AI or change your recording.</p>
 </fieldset>;
}
