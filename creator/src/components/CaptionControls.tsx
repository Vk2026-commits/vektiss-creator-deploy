import type {EditBrand} from '../domain/edit-brand';
export function CaptionControls({brand,onChange,disabled=false}:{brand:EditBrand;onChange:(brand:EditBrand)=>void;disabled?:boolean}){
 const size=Math.round((brand.captionScale??1)*100),offset=brand.captionOffsetY??0;
 return <fieldset disabled={disabled||brand.captionStyle==='none'} className="edit-plan-details"><legend>Caption size & position</legend>
  <label>Caption size · {size}%<input type="range" min="60" max="150" step="5" value={size} aria-valuetext={`${size} percent`} onChange={e=>onChange({...brand,captionScale:Number(e.target.value)/100})}/></label>
  <label>Move captions up/down · {offset===0?'Default':`${Math.abs(offset)}% ${offset<0?'higher':'lower'}`}<input type="range" min="-30" max="30" step="1" value={offset} aria-valuetext={offset===0?'Default position':`${Math.abs(offset)} percent ${offset<0?'higher':'lower'}`} onChange={e=>onChange({...brand,captionOffsetY:Number(e.target.value)})}/></label>
  <p>Left moves captions up; right moves them down. Preview to check their position against your video and graphics.</p>
  <div aria-label="Caption adjustment sample" style={{height:180,position:'relative',overflow:'hidden',borderRadius:12,background:'#10263D',color:'#fff'}}><span style={{position:'absolute',left:'6%',width:'88%',top:`${45+offset}%`,textAlign:'center',fontSize:20*(brand.captionScale??1),fontWeight:700}}>Create <span style={{color:brand.primary}}>real value</span></span></div>
  <button type="button" className="button" onClick={()=>onChange({...brand,captionScale:1,captionOffsetY:0})}>Reset caption size & position</button>
 </fieldset>;
}
