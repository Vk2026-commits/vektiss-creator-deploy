/** Approved Ranking look. Versioned so future styles cannot silently replace it. */
export const rankingDefault = {
 id:'creator-ranking-v1', name:'Creator Ranking',
 description:'Full-screen presenter, a lower ranking board, word-highlight captions, and cards that pop up then slide into their tiers. Start speaking with the first ranking; the on-screen title is optional.',
 boardTop:59, boardHeight:31, captionTop:49,
 entranceDuration:.45, entranceDistance:-36, entranceScale:.88,
} as const;
