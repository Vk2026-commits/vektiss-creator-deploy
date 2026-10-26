import {useEffect,useMemo,useRef} from 'react';
import {hyperframesProject} from '../domain/hyperframes-project';
import {templateSample,templateSampleSource} from '../domain/edit-template-samples';
import {editDimensions,type EditAspectRatio} from '../domain/edit-format';
import type {EditBrand} from '../domain/edit-brand';
export function HyperframesSample({brand,frame,aspectRatio}:{brand:EditBrand;frame:number;aspectRatio:EditAspectRatio}){
 const ref=useRef<HTMLIFrameElement>(null);
 const html=useMemo(()=>hyperframesProject(templateSampleSource,{...templateSample('hyperframes-motion'),aspectRatio},brand,true),[brand,aspectRatio]);
 const seek=()=>ref.current?.contentWindow?.postMessage({type:'vektiss-seek',time:frame/30},'*');
 useEffect(seek,[frame,html]);
 return <iframe ref={ref} title="HyperFrames Motion animated sample" sandbox="allow-scripts" srcDoc={html} onLoad={seek} style={{...editDimensions(aspectRatio),border:0,pointerEvents:'none'}}/>;
}
