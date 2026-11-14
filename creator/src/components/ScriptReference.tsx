export function ScriptReference({value,onChange,disabled}:{value?:string;onChange:(value:string)=>void;disabled?:boolean}) {
 return <details className="script-context"><summary>Reference script & writing style (optional)</summary><p>Paste a script you like. We’ll use its structure, pacing and voice for this topic, while keeping your source facts and selected call to action.</p><label>Reference script<textarea rows={6} maxLength={15000} value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value)} placeholder="Paste your example script here…"/></label></details>;
}
