import {useEffect,useRef,useState} from 'react';
import type {DiscoveryFilters} from '../domain/discovery-engagement';
const displayNumber=(value:number,step:number)=>step<1?String(value):value.toLocaleString('en-US');
function FilterNumber({value,onChange,min,max,step,disabled}:{value:number;onChange:(value:number)=>void;min:number;max:number;step:number;disabled:boolean}){
 const [draft,setDraft]=useState(displayNumber(value,step));
 const editing=useRef(false);
 useEffect(()=>{if(!editing.current)setDraft(displayNumber(value,step));},[value,step]);
 return <input type="text" inputMode={step<1?'decimal':'text'} disabled={disabled} value={draft}
  onFocus={()=>{editing.current=true;}}
  onChange={event=>{
   const raw=event.target.value;
   if(!(step<1?/^\d*(?:\.\d*)?$/:/^[\d,]*$/).test(raw))return;
   setDraft(raw);
   const digits=raw.replace(/,/g,'');
   const next=Number(digits);
   if(digits!==''&&Number.isFinite(next)&&next>=min&&next<=max)onChange(next);
  }}
  onBlur={()=>{
   editing.current=false;
   const parsed=Number(draft.replace(/,/g,''));
   const next=Math.min(max,Math.max(min,Number.isFinite(parsed)?parsed:value));
   setDraft(displayNumber(next,step));onChange(next);
  }}/>
}
export function DiscoverFilters({value,onChange,disabled}:{value:DiscoveryFilters;onChange:(next:DiscoveryFilters)=>void;disabled:boolean}){
 const update=(patch:Partial<DiscoveryFilters>)=>onChange({...value,...patch});
 return <section className="discover-filters" aria-label="Clip search filters">
  <div className="discovery-platforms" role="group" aria-label="Video platform">{(['all','YouTube','Instagram','TikTok'] as const).map(platform=><button type="button" key={platform} disabled={disabled} aria-pressed={value.platform===platform} className={value.platform===platform?'is-selected':''} onClick={()=>update({platform})}>{platform==='all'?'All platforms':platform}</button>)}</div>
  <div className="discovery-filter-fields">
   <label>Find<select disabled={disabled} value={value.mode} onChange={e=>{const mode=e.target.value as DiscoveryFilters['mode'];update({mode,minViews:mode==='relevant'?0:Math.max(10000,value.minViews),minEngagementRate:mode==='relevant'?0:value.minEngagementRate||1});}}><option value="engaged">High engagement</option><option value="outliers">Creator outliers</option><option value="relevant">Relevant clips</option></select></label>
   <label>Minimum views<FilterNumber min={0} max={1e9} step={1000} disabled={disabled} value={value.minViews} onChange={minViews=>update({minViews})}/></label>
   <label>Minimum engagement %<FilterNumber min={0} max={100} step={0.1} disabled={disabled} value={value.minEngagementRate} onChange={minEngagementRate=>update({minEngagementRate})}/></label>
   <label>Published<select disabled={disabled} value={value.maxAgeDays} onChange={e=>update({maxAgeDays:Number(e.target.value) as DiscoveryFilters['maxAgeDays']})}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option><option value="0">Any time</option></select></label>
   {value.mode==='outliers'&&<label>Above creator’s median<FilterNumber min={2} max={20} step={0.5} disabled={disabled} value={value.outlierMultiple} onChange={outlierMultiple=>update({outlierMultiple})}/></label>}
  </div>
  <p>Thresholds apply to new searches; 0 turns off a threshold. Platform also filters your saved results. Engagement = available likes, comments and shares ÷ views. Missing metrics cannot pass a threshold.</p>
  {value.mode==='outliers'&&<p>Outliers need at least five other recent videos from the same creator. We check up to five creators, ten recent videos each. The multiple compares current views with that sample’s median; it is not adjusted for video age or a promise of future performance.</p>}
 </section>;
}
