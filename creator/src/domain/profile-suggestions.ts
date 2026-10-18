import type { CreatorInput } from './strategy';

export type ProfileQuestionKey = 'name' | 'primary_audience' | 'content_pillars' | 'audience_problems' |
  'source_topics' | 'reaction_angles' | 'tone' | 'things_to_avoid' | 'desired_outcomes' | 'cta';

type Suggestions = Record<ProfileQuestionKey, string[]>;

const safety: Suggestions = {
  name: ['Everyday safety with {name}', 'Situational awareness for women', 'Practical safety tips with {name}'],
  primary_audience: ['Women who want to feel safer in everyday situations', 'People learning to recognize and respond to uncomfortable situations'],
  content_pillars: ['Situational awareness', 'Personal safety in everyday places', 'Getting help without escalating a situation'],
  audience_problems: ['Noticing warning signs early', 'Knowing what to do when someone feels unsafe', 'Finding a safe way to ask for help'],
  source_topics: ['Real accounts of uncomfortable encounters in public places', 'Practical personal-safety demonstrations', 'Everyday situations where someone sought help'],
  reaction_angles: ['Explain the safest practical next step', 'Point out the moment someone could seek help', 'Separate useful precautions from fear-based advice'],
  tone: ['Calm and reassuring', 'Direct and practical', 'Clear without creating fear'],
  things_to_avoid: ['Victim-blaming', 'Fear-based claims', 'Guarantees that any tactic will work'],
  desired_outcomes: ['One practical step to remember', 'More confidence in seeking help', 'A clearer way to assess the situation'],
  cta: ['Follow for practical everyday safety tips', 'Share this with someone who might find it useful'],
};

const finance: Suggestions = {
  name: ['Practical money guidance with {name}', 'Understanding credit and money', 'Money decisions made clearer'],
  primary_audience: ['People making important money decisions', 'Families looking for clearer financial guidance'],
  content_pillars: ['Understanding financial options', 'Common credit questions', 'Everyday money decisions'],
  audience_problems: ['Understanding unfamiliar financial terms', 'Knowing which questions to ask', 'Comparing options without feeling pressured'],
  source_topics: ['Real consumer money questions', 'Credit and lending changes that affect everyday people', 'Examples of confusing financial offers'],
  reaction_angles: ['Explain what this means in everyday life', 'Clarify a common misconception', 'Give one practical question to ask'],
  tone: ['Clear and educational', 'Calm and direct', 'Supportive without overpromising'],
  things_to_avoid: ['Guaranteed results', 'Unsupported savings claims', 'Personalized financial advice without context'],
  desired_outcomes: ['A clearer understanding', 'One useful question to ask', 'More confidence comparing options'],
  cta: ['Follow for practical money explanations', 'Ask a question you want explained next'],
};

const business: Suggestions = {
  name: ['Better systems with {name}', 'Practical business growth', 'Less busywork for business owners'],
  primary_audience: ['Small-business owners looking for more efficient ways to work', 'Creators and entrepreneurs handling too much manually'],
  content_pillars: ['Removing repetitive work', 'Improving customer experiences', 'Practical business systems'],
  audience_problems: ['Spending too much time on repetitive tasks', 'Losing leads through slow follow-up', 'Growing without adding more busywork'],
  source_topics: ['Business owners describing frustrating manual work', 'Creators showing time-consuming workflows', 'Real examples of simpler customer experiences'],
  reaction_angles: ['Identify the friction in the current process', 'Show a simpler way to handle the work', 'Explain where automation could help'],
  tone: ['Practical and direct', 'Curious and constructive', 'Clear without hype'],
  things_to_avoid: ['Unproven growth promises', 'Generic AI hype', 'Claiming every task should be automated'],
  desired_outcomes: ['One process worth simplifying', 'A practical next step', 'A clearer opportunity to save time'],
  cta: ['Follow for practical business systems', 'Comment with a process you wish were simpler'],
};

function topicFromCreator(creator?: CreatorInput): string {
  const raw = creator?.context.expertise || creator?.context.experience || creator?.context.industries[0] || creator?.bio || '';
  const first = raw.split(/[.;\n]/)[0].replace(/^(i (?:help|teach|work in|specialize in)|my expertise is)\s+/i, '').trim();
  return first.slice(0, 70) || 'your area of expertise';
}

export function suggestedProfileExamples(key: ProfileQuestionKey, creator?: CreatorInput): string[] {
  const context = [creator?.context.expertise, creator?.context.experience, creator?.context.industries.join(' '), creator?.bio]
    .filter(Boolean).join(' ').toLowerCase();
  const name = creator?.display_name.trim().split(/\s+/)[0] || 'you';
  const collection = /safety|security|situational awareness|self.defen[sc]e|personal protection/.test(context) ? safety
    : /credit|mortgage|lending|finance|financial|budget|banking/.test(context) ? finance
    : /business|entrepreneur|marketing|automation|software|creator|ai systems/.test(context) ? business
    : null;
  if (collection) return collection[key].map(example => example.replaceAll('{name}', name));

  const topic = topicFromCreator(creator);
  const lowerTopic = topic.charAt(0).toLowerCase() + topic.slice(1);
  const general: Suggestions = {
    name: [`${topic} with ${name}`, `Practical ${lowerTopic} insights`],
    primary_audience: [`People looking for practical guidance on ${lowerTopic}`],
    content_pillars: [`The basics of ${lowerTopic}`, `Real-world lessons from ${lowerTopic}`],
    audience_problems: [`Knowing where to start with ${lowerTopic}`, 'Separating useful advice from common misconceptions'],
    source_topics: [`Real situations involving ${lowerTopic}`, `Questions people ask about ${lowerTopic}`],
    reaction_angles: ['Explain what matters in this situation', 'Offer one practical next step'],
    tone: ['Clear and approachable', 'Direct and helpful'],
    things_to_avoid: ['Unsupported claims', 'Promises you cannot verify'],
    desired_outcomes: ['One useful idea to try', 'A clearer understanding'],
    cta: ['Follow for more practical guidance', 'Ask a question you want answered next'],
  };
  return general[key];
}
