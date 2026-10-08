export function RenderProgress({value,label,estimated=true,indeterminate=false}:{value:number;label:string;estimated?:boolean;indeterminate?:boolean}) {
 return <div className="render-progress" role="status"><div><strong>{label}</strong>{!indeterminate&&<span>{value}%{estimated?' estimated':''}</span>}</div><progress aria-label={label} value={indeterminate?undefined:value} max={100}/></div>;
}
