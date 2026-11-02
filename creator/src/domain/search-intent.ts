import type {ResearchBrief,ResearchSource} from './research.ts';

// Inclusion rules, not exclusions, determine the requested format.
export function wantsVisibleAction(brief:ResearchBrief):boolean {
 if(brief.visibleActionOnly!==undefined)return brief.visibleActionOnly;
 const positive=[brief.researchSeekSituations??'',...brief.sourceTopics,
  ...brief.researchScreeningCriteria.split('\n').filter(line=>!/^Reject topics|^Negative examples/i.test(line))].join(' ');
 return /action[ -]packed|visible (?:action|incident)|(?:incidents?|events?) (?:caught|captured) on (?:camera|video)|(?:steps|techniques|intervention|de-escalation).{0,45}in action|real.{0,20}incident footage/i.test(positive);
}
export function actionFormatRejection(brief:ResearchBrief,source:ResearchSource):string|null {
 if(!wantsVisibleAction(brief))return null;
 const observations=(source.review?.observations??'').split(/[.!?\n]/).filter(line=>! /\b(?:not|no|without)\b/i.test(line)).join(' ');
 const text=`${source.title}\n${source.snippet}\n${observations}`;
 // Only explicit format evidence; don't reject car footage merely for saying "car".
 return /\bstory[ -]?time\b|\btalking head\b|\bsitting in (?:my|her|his|a|the) car.{0,60}(?:talk|tell|explain)|\b(?:let me tell you|telling (?:my|her|his) story|recounting (?:my|her|his|an) (?:experience|incident))\b/i.test(text)
  ?'Narration-only/storytime format does not meet this profile’s visible-action requirement':null;
}
export function actionEvidenceInstruction(brief:ResearchBrief):string {
 return wantsVisibleAction(brief)?'STRICT FORMAT REQUIREMENT: This profile wants the situation/action itself on screen, not a person merely recounting it. Reject narration-only car monologues, storytimes, generic safety lectures and reaction-only clips. Recorded conversations can qualify when the interaction itself contains observable warning signs or decision points. Apply the selected profile’s rules for demonstrations, simulations and reenactments; do not override an explicit permission with a blanket ban. Label simulated or promotional footage in the title and summary, never as a verified real incident. News-account footage can qualify when it shows the situation rather than only reporting it. Require source evidence of the requested visual format; a caption merely saying an event happened is insufficient. If the format cannot be established, omit the lead rather than using Watch first to waive this requirement. Never claim to have watched footage from metadata alone. Keep the practical teaching relevance; action does not mean gratuitous violence.':'';
}

export function actionSearchQuery(query:string,index=0):string{
 if(/caught on camera|cctv|bodycam|dashcam|demonstration|incident footage/i.test(query))return query;
 return `${query} ${['caught on camera','incident footage','demonstration'][index%3]}`;
}
export function actionReviewEligible(brief:ResearchBrief,source:ResearchSource):boolean{
 return !wantsVisibleAction(brief)||(!actionFormatRejection(brief,source)&&!(source.durationSeconds!==undefined&&source.durationSeconds>180));
}
export function actionRetrievalScore(source:ResearchSource):number{
 return /caught on camera|cctv|bodycam|dashcam|footage shows|demonstrat|interven|rescue/i.test(source.title+' '+source.snippet)?1:0;
}
