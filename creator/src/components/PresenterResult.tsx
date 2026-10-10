import {useRef,useState} from 'react';
import {avatarRepository} from '../lib/avatar-repository';
import './presenter-result.css';
export function PresenterResult({id,url,downloadUrl,previewUrl,previewDownloadUrl,onRefresh,onChangePresenter}:{id:string;url:string;downloadUrl?:string|null;previewUrl?:string|null;previewDownloadUrl?:string|null;onRefresh?:()=>void;onChangePresenter?:()=>void}){
 const video=useRef<HTMLVideoElement>(null);
 const [downloading,setDownloading]=useState(false);
 const [error,setError]=useState('');
 const [background,setBackground]=useState('checker');
 const [cutout,setCutout]=useState(false);
 const [loadedUrl,setLoadedUrl]=useState('');
 const playbackUrl=previewUrl&&!cutout?previewUrl:url;
 async function download(){
  setDownloading(true);setError('');
  try{
   const blob=await avatarRepository.renderTest({action:'download_test',test_id:id});
   if(!(blob instanceof Blob)||!blob.size)throw Error('No video data received. Refresh status and try again.');
   const objectURL=URL.createObjectURL(new Blob([blob],{type:'video/webm'}));
   const link=document.createElement('a');link.href=objectURL;link.download='vektiss-presenter-test.webm';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectURL),60000);
  }catch(e){setError(e instanceof Error?e.message:'Download failed. Please retry.');}finally{setDownloading(false);}
 }
 return <div className="presenter-result">{loadedUrl!==playbackUrl&&!error&&<p className="test-processing" role="status">Loading your test video…</p>}<div className={`presenter-result-stage ${background}`}><video key={playbackUrl} ref={video} src={playbackUrl} controls playsInline preload="auto" onError={()=>setError('The video could not load. Retry below; some Safari versions need the MP4 preview.')} onLoadedData={()=>{setError('');setLoadedUrl(playbackUrl);}}/></div>
 <details><summary>More options</summary><div className="presenter-result-actions"><button type="button" className="button" onClick={()=>{void video.current?.play().catch(()=>setError('Playback failed. Refresh the video link or use the MP4 preview.'));}}>Play preview</button>{previewDownloadUrl&&<a className="button" href={previewDownloadUrl} download="vektiss-presenter-preview.mp4">Download MP4</a>}{downloadUrl?<a className="button" href={downloadUrl} download="vektiss-presenter-cleaned.webm">Download cutout (.webm)</a>:<button type="button" className="button" disabled={downloading} onClick={()=>void download()}>{downloading?'Downloading…':'Download video (.webm)'}</button>}{onChangePresenter&&<button type="button" onClick={onChangePresenter}>Change avatar</button>}</div>
 {previewUrl&&<button type="button" onClick={()=>{setCutout(value=>!value);setError('');}}>{cutout?'Use MP4 preview':'View transparent cutout'}</button>}
 {(!previewUrl||cutout)&&<div className="presenter-result-backgrounds" aria-label="Preview background">{['checker','light','dark'].map(value=><button type="button" key={value} aria-pressed={background===value} onClick={()=>setBackground(value)}>{value==='checker'?'Transparency':value==='light'?'Light background':'Dark background'}</button>)}</div>}
 <p className="presenter-result-note">MP4: easy playback, solid background. WebM: transparent cutout for editing.</p>
 <details><summary>File & playback help</summary><p>WebM is a video file, not a webpage. Your computer may associate it with Chrome. This original keeps transparency; MP4 exports require a background. Some Safari versions display transparent video against black.</p><a href={url} target="_blank" rel="noreferrer">Open original in a new tab</a></details>
 {onRefresh&&<button type="button" onClick={onRefresh}>Refresh video links</button>}</details>{error&&<p role="alert">{error}{onRefresh&&<button type="button" onClick={onRefresh}>Retry loading video</button>}</p>}</div>;
}
