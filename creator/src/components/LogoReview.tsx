import {useEffect,useState} from 'react';
import {logoBrands,type LogoSuggestion} from '../domain/logo-assets';
import {mediaFetch} from '../lib/media-fetch';
export type LogoChoice=LogoSuggestion&{replacementId?:string};
function LogoImage({logo}:{logo:LogoChoice}){
 const [url,setUrl]=useState(''); const [failed,setFailed]=useState(false);
 useEffect(()=>{let live=true,objectUrl='';setUrl('');setFailed(false);if(!logo.assetId)return;void mediaFetch(`/api/local-capture/template-logos/${logo.assetId}`).then(async r=>{if(!r.ok)throw Error();const blob=await r.blob();if(!live)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[logo.assetId]);
 return url?<img src={url} alt={`${logo.name} suggested logo`} style={{width:96,height:96,objectFit:'contain',background:'#fff',borderRadius:12}}/>:<p>{failed?'Logo preview could not load. Review the official source or omit it.':logo.assetId?'Loading logo…':'No suitable logo found'}</p>;
}
export function LogoReview({logos,busy,onChange}:{logos:LogoChoice[];busy:boolean;onChange:(logos:LogoChoice[])=>void}){
 return <fieldset disabled={busy}><legend>Review suggested logos</legend><p>These images were retrieved from official sites. Approve the correct brand, omit it, or choose a replacement. Replacements are retrieved when you save and need approval afterward.</p>
 {!logos.length&&<p>No supported brands were identified. This edit will use your presenter and text graphics. Automatic lookup currently supports {logoBrands.map(b=>b.name).join(', ')}.</p>}
 {logos.map((logo,i)=><article key={logo.brandId} style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap',padding:'16px 0',borderBottom:'1px solid #dce5ef'}}><LogoImage logo={logo}/><div><h3>{logo.name}</h3><a href={logo.sourceUrl??logo.site} target="_blank" rel="noreferrer">View official source</a>{logo.message&&<p>{logo.message}</p>}<label>Use this logo<select value={logo.status} onChange={e=>onChange(logos.map((l,j)=>i===j?{...l,status:e.target.value as LogoChoice['status']}:l))}><option value="pending" disabled={!logo.assetId}>Needs review</option><option value="approved" disabled={!logo.assetId||!!logo.replacementId}>Approved</option><option value="omitted">Omit from video</option>{!logo.assetId&&<option value="unavailable">Unavailable</option>}</select></label><label>Replace with<select value={logo.replacementId??''} onChange={e=>onChange(logos.map((l,j)=>i===j?{...l,replacementId:e.target.value||undefined,status:'pending'}:l))}><option value="">Keep suggested brand</option>{logoBrands.filter(b=>!logos.some(l=>l.brandId===b.id)).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div></article>)}
 </fieldset>;
}
