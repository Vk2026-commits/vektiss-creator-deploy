import {z} from 'zod';
export const languageLevelSchema=z.enum(['simple','everyday','technical']);
export type LanguageLevel=z.infer<typeof languageLevelSchema>;
export const languageLevels=[{value:'simple',label:'Simple · about fifth-grade level'},{value:'everyday',label:'Everyday · conversational'},{value:'technical',label:'Technical · knowledgeable audience'}] as const;
export function resolveLanguageLevel(script?:LanguageLevel,profile?:LanguageLevel){return script??profile;}
export function languageLevelInstruction(level?:LanguageLevel){
 if(!level)return '';
 const directions={simple:'Aim for approximately fifth-grade reading level. Use familiar words, short sentences and one idea at a time. Explain necessary technical terms in plain words. Sound like an informed adult, never childish or condescending.',everyday:'Use conversational everyday language with moderate detail. Explain unfamiliar jargon briefly. Sound natural when spoken.',technical:'Use precise terminology and deeper explanations appropriate to a knowledgeable audience. Do not add jargon just to sound impressive or invent expertise, credentials or evidence.'};
 return `LANGUAGE LEVEL: ${directions[level]} Preserve the approved argument, meaningful distinctions, factual qualifications, ranking labels/order and selected CTA. Simplify wording, not truth. Preserve exact-wording CTAs verbatim. Reference scripts guide structure but do not override this language level. Explicit language instructions in the current revision_request take precedence for this revision only. Do not include reading-level labels in spoken copy.`;
}
export function languageRevisionRequest(level:LanguageLevel){return `Change only the language complexity to ${level}. Keep the current topic, argument, structure, factual qualifications, approved rankings and selected CTA. Do not invent facts or replace the script with a new topic.`;}
