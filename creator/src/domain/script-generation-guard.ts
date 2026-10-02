import type {ScriptBrief} from './script-brief';
/** Notes and clarification are optional; substantive source evidence is not. */
export function scriptInputError(action:'summarize'|'clarify'|'generate',brief:ScriptBrief):string|null {
 if(action==='summarize')return brief.source.trim().length<40&&(!brief.url||brief.kind!=='article')?'SOURCE_REQUIRED':null;
 return brief.source.trim().length<40?'SOURCE_REQUIRED':null;
}
