import {languageLevels,type LanguageLevel} from '../domain/language-level';
export function LanguageLevelSelect({value,onChange,disabled,defaultLabel='Keep current style'}:{value?:LanguageLevel;onChange:(value:LanguageLevel|undefined)=>void;disabled?:boolean;defaultLabel?:string}){
 return <label className="field"><span>Language level</span><select value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value?e.target.value as LanguageLevel:undefined)}><option value="">{defaultLabel}</option>{languageLevels.map(level=><option key={level.value} value={level.value}>{level.label}</option>)}</select></label>;
}
