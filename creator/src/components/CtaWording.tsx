import type {CTA} from '../domain/cta';

export function CtaWording({value,onChange}:{value:CTA['wording'];onChange:(value:NonNullable<CTA['wording']>)=>void}){
 return <label className="field"><span>CTA wording</span><select value={value??'natural'} onChange={event=>onChange(event.target.value==='exact'?'exact':'natural')}><option value="natural">Adapt naturally</option><option value="exact">Use exact wording</option></select><small>{value==='exact'?'Use the invitation exactly as written. Write words you want spoken aloud.':'Turn your offer into a direct invitation relevant to each video. Keep the keyword and offer unchanged.'} Applies when you generate or rewrite a script; saved videos stay unchanged.</small></label>;
}
