import type {ResearchBrief,ResearchSource} from './research.ts';

// Inclusion rules, not exclusions, determine the requested format.
export function wantsVisibleAction(brief:ResearchBrief):boolean {
 const positive=[brief.researchSeekSituations??'',...brief.sourceTopics,
  ...brief.researchScreeningCriteria.split('\n').filter(line=>!/^Reject topics|^Negative examples/i.test(line))].join(' ');
 return /action[ -]packed|visible (?:action|incident)|(?:incidents?|events?) (?:caught|captured) on (?:camera|video)|(?:steps|techniques|intervention|de-escalation).{0,45}in action|real.{0,20}incident footage/i.test(positive);
}
export function actionFormatRejection(brief:ResearchBrief,source:ResearchSource):string|null {
 if(!wantsVisibleAction(brief))return null;
 const text=`${source.title}\n${source.snippet}`;
 // Only explicit format evidence; don't reject car footage merely for saying "car".
 return /\bstory[ -]?time\b|\btalking head\b|\bsitting in (?:my|her|his|a|the) car.{0,60}(?:talk|tell|explain)|\b(?:let me tell you|telling (?:my|her|his) story|recounting (?:my|her|his|an) (?:experience|incident))\b/i.test(text)
  ?'Narration-only/storytime format does not meet this profile’s visible-action requirement':null;
}
export function actionEvidenceInstruction(brief:ResearchBrief):string {
 return wantsVisibleAction(brief)?'STRICT FORMAT REQUIREMENT: This profile wants the incident/action itself on screen, not a person recounting it. Reject car monologues, storytimes, phone conversations, generic safety lectures, reenactments and reaction-only clips. Require source evidence that footage depicts the incident or intervention; a caption merely saying it happened is insufficient. If the format cannot be established, omit the lead rather than using Watch first to waive this requirement. Never claim to have watched footage from metadata alone. Keep the safety/de-escalation teaching relevance; action does not mean gratuitous violence.':'';
}
