import {useEffect,useRef,useState} from 'react';
import {Wallet,RefreshCw} from 'lucide-react';
import {z} from 'zod';
import {avatarRepository} from '../lib/avatar-repository';
import {subscribeAvatarLibrary} from '../lib/avatar-library-events';
import {onResume} from '../lib/resume-events';

const balanceSchema=z.object({items:z.array(z.object({label:z.string(),value:z.number().finite(),unit:z.string()})),checked_at:z.string()});
export function balanceBadgeValue(items:z.infer<typeof balanceSchema>['items']){
 const available=items.filter(i=>i.label==='API balance'||i.label==='Premium credits'||i.label==='Add-on credits');
 if(!available.length||available.some(i=>i.unit!==available[0].unit))return null;
 return {value:available.reduce((n,i)=>n+i.value,0),unit:available[0].unit};
}
export function HeyGenBalanceBadge({preview=false}:{preview?:boolean}){
 const [balance,setBalance]=useState<ReturnType<typeof balanceBadgeValue>>(null);
 const [state,setState]=useState('Checking balance');const [busy,setBusy]=useState(false);
 const [checked,setChecked]=useState('');const refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let live=true,loading=false;
  async function refresh(){
   if(preview||loading||document.hidden)return;loading=true;setBusy(true);
   try{
    const library=await avatarRepository.library();
    const avatar=library.avatars.find(a=>a.is_default)??library.avatars[0];
    if(!avatar){if(live){setBalance(null);setState('Connect HeyGen');}return;}
    const result=balanceSchema.parse(await avatarRepository.renderTest({action:'balance',avatar_id:avatar.id}));
    if(live){setBalance(balanceBadgeValue(result.items));setChecked(result.checked_at);setState('Balance unavailable');}
   }catch{if(live){setBalance(null);setState('Balance unavailable');}}
   finally{loading=false;if(live)setBusy(false);}
  }
  refreshRef.current=()=>void refresh();void refresh();
  const off=onResume(()=>void refresh());const unsubscribe=subscribeAvatarLibrary(()=>void refresh());
  const timer=setInterval(()=>void refresh(),300000);
  return()=>{live=false;clearInterval(timer);off();unsubscribe();};
 },[preview]);
 const low=balance!==null&&balance.value<5;
 const amount=balance?balance.unit==='usd'?`$${balance.value.toFixed(2)} USD`:`${balance.value.toLocaleString()} credits`:preview?'Preview':state;
 return <button type="button" className={`heygen-balance-badge ${balance?low?'is-low':'is-healthy':'is-unknown'}`} disabled={busy||preview} onClick={()=>refreshRef.current()} aria-label={`HeyGen ${amount}. ${low?'Low balance. ':''}Refresh balance`} title={`Connected default HeyGen account${checked?` · Checked ${new Date(checked).toLocaleString()}`:''}. Click to refresh. Threshold: 5 in the displayed currency or credit units.`}>
  <Wallet size={19} aria-hidden="true"/><span><span className="heygen-balance-label">HEYGEN {low?'· LOW BALANCE':''}</span><strong aria-live="polite">{amount}</strong></span><RefreshCw size={13} aria-hidden="true" className={busy?'balance-spinning':''}/>
 </button>;
}
