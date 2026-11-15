// Keep retrieval bounded while giving qualification enough distinct candidates.
export function articleCandidateTarget(requested: number) {
  return Math.min(30, Math.max(8, requested * 3));
}
export function articleRoundDirection(round: number, topics: string[]) {
  const lanes = [
    'Search across the profile topics for distinct recent reported events. Spread searches across publishers; do not spend the whole search on one topic.',
    'Use different topic wording and publishers from the first attempt. Prioritize underrepresented profile topics and concrete customer, employment, product, and business developments that fit those topics.',
    'Run a gap-filling search: use specific entities and events found so far to find different relevant stories, not syndicated copies or alternate coverage of the same event.',
  ];
  const offset = Math.max(0, round - 1) % Math.max(1, topics.length);
  const rotated = [...topics.slice(offset), ...topics.slice(0, offset)];
  return `${lanes[Math.min(2, Math.max(0, round - 1))]} Topic priority: ${JSON.stringify(rotated)}. Keep the original dates, publisher policy, relevance threshold, and subject exclusions.`;
}
