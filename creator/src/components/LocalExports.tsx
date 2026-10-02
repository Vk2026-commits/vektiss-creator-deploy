import {mediaFetch} from "../lib/media-fetch";
import {useEffect,useState} from 'react';

// Files predate script/layout metadata. Never claim they belong to the selected script.
export function LocalExports(){
 const [items,setItems]=useState<{id:string;created_at:string}[]>([]);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<{id:string;url:string}|null>(null);
 useEffect(()=>{const abort=new AbortController();mediaFetch('/api/local-capture/exports',{headers:{'X-Creator-Capture':'1'},signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setItems).catch(()=>{if(!abort.signal.aborted)setError('Could not load local exports.');});return()=>abort.abort();},[]);
 useEffect(()=>()=>{if(selected)URL.revokeObjectURL(selected.url);},[selected]);
 async function open(id:string){setBusy(true);setError('');try{const r=await mediaFetch(`/api/local-capture/exports/${id}`,{headers:{'X-Creator-Capture':'1'}});if(!r.ok||!r.headers.get('content-type')?.startsWith('video/mp4'))throw Error();setSelected({id,url:URL.createObjectURL(await r.blob())});}catch{setError('Could not open this local export.');}finally{setBusy(false);}}
 return <section aria-label="Saved local video exports"><h2>Your exported videos</h2><p>Existing MP4s on this computer—no new HeyGen render needed. Earlier exports were not linked to a script or size; preview them to identify your version.</p>{error&&<p role="alert">{error}</p>}{items.length?items.map((item,i)=><button className="button" type="button" key={item.id} disabled={busy} onClick={()=>void open(item.id)}>{i===0?'Latest export':'Earlier export'} · {new Date(item.created_at).toLocaleString()}</button>):<p>No local exports found.</p>}{selected&&<><video src={selected.url} controls playsInline style={{display:'block',maxWidth:'100%',maxHeight:560,margin:'16px auto'}}/><a className="button" href={selected.url} download={`vektiss-export-${selected.id}.mp4`}>Download this MP4</a></>}</section>;
}
