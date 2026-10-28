import {useEffect,useState} from 'react';

// An open tab keeps its original JavaScript after a deployment. Never reload an
// editor automatically: its local source selection or unsaved edits may be lost.
export function AppUpdateNotice(){
 const [available,setAvailable]=useState(false);
 useEffect(()=>{
  if(import.meta.env.DEV)return;
  const current=[...document.scripts].map(s=>s.src).find(s=>s.includes('/assets/index-'));
  if(!current)return;
  let disposed=false;
  const check=async()=>{
   if(document.visibilityState!=='visible')return;
   try{
    const response=await fetch('/',{cache:'no-store'});
    if(!response.ok)return;
    const page=new DOMParser().parseFromString(await response.text(),'text/html');
    const script=[...page.scripts].map(s=>s.getAttribute('src')).find(s=>s?.includes('/assets/index-'));
    if(!disposed&&script&&new URL(script,location.href).href!==current)setAvailable(true);
   }catch{/* A failed update check must not interrupt editing. */}
  };
  void check();const timer=setInterval(()=>void check(),60000);
  const focus=()=>void check();window.addEventListener('focus',focus);
  return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',focus);};
 },[]);
 return available?<aside role="status" className="app-update-notice"><strong>A Creator update is ready.</strong><span>Finish your export and save your edits, then reload to get the latest fixes.</span><button onClick={()=>location.reload()}>Reload Creator</button></aside>:null;
}
