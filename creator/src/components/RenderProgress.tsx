export function RenderProgress({value,label,estimated=true}:{value:number;label:string;estimated?:boolean}) {
 return <div className="render-progress" role="status"><div><strong>{label}</strong><span>{value}%{estimated?' estimated':''}</span></div><progress aria-label={label} value={value} max={100}/></div>;
}
