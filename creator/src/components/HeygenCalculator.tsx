import {useState} from 'react';
import {HEYGEN_RATE_SOURCE,heygenPrice,heygenRate} from '../domain/heygen-pricing';
export function HeygenCalculator(){
 const [engine,setEngine]=useState('avatar_iv'),[type,setType]=useState('digital_twin'),[seconds,setSeconds]=useState('60'),[count,setCount]=useState('10'),[price,setPrice]=useState('');
 const rate=heygenRate(engine,type),one=heygenPrice(engine,type,Number(seconds));
 const valid=one!==null&&Number.isInteger(Number(count))&&Number(count)>0;
 const total=valid?one!*Number(count):null;
 const money=(v:number)=>`$${v.toFixed(2)}`;
 return <section><h2>What will these videos cost?</h2><p>Pick an avatar engine and video length. We do the HeyGen math for you.</p><div className="cost-filters">
 <label>Avatar engine<select value={engine} onChange={e=>setEngine(e.target.value)}><option value="avatar_iii">Avatar III</option><option value="avatar_iv">Avatar IV</option><option value="avatar_v">Avatar V</option></select></label>
 <label>Avatar type<select value={type} onChange={e=>setType(e.target.value)}><option value="digital_twin">Digital Twin (video avatar)</option><option value="photo_avatar">Photo avatar</option><option value="studio_avatar">Studio avatar</option></select></label>
 <label>Seconds in each video<input type="number" min="1" value={seconds} onChange={e=>setSeconds(e.target.value)}/></label>
 <label>Number of videos<input type="number" min="1" step="1" value={count} onChange={e=>setCount(e.target.value)}/></label>
 <label>What you charge for all of them · $ (optional)<input type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label></div>
 {total===null?<p role="status">{rate===null?'HeyGen does not list a rate for this combination. Choose another avatar type or engine.':'Enter a positive length and a whole number of videos.'}</p>:<div className="cost-price"><p>One video: <strong>{money(one!)}</strong></p><p>{count} videos: <strong>{money(total)}</strong> in HeyGen costs.</p><p>{money(rate!)} per minute × {seconds} seconds ÷ 60 × {count} videos = {money(total)}.</p>{price!==''&&Number.isFinite(Number(price))&&Number(price)>=0&&<p>You charge {money(Number(price))}. That leaves <strong>{money(Number(price)-total)}</strong> before search, hosting, support and other costs.</p>}</div>}
 <p>Calculated from <a href={HEYGEN_RATE_SOURCE} target="_blank" rel="noreferrer">HeyGen API rates</a> checked October 14, 2026. Each new render or paid test costs extra. This is not your final profit or a confirmed invoice.</p></section>;
}
