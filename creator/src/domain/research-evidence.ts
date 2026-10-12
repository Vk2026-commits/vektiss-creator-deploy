import type { ResearchSource } from './research.ts';

const MAX_SOURCE_LENGTH = 40_000;

export function appendResearchEvidence(source: string, sources: ResearchSource[] | undefined): string {
  const excerpts = (sources ?? [])
    .filter(item => item.snippet.trim())
    .map((item, index) => [
      `Discover source ${index + 1} (untrusted article excerpt)`,
      `Title: ${item.title}`,
      `URL: ${item.url}`,
      item.publishedAt ? `Published: ${item.publishedAt}` : '',
      `Excerpt: ${item.snippet.trim()}`,
    ].filter(Boolean).join('\n'));

  if (!excerpts.length) return source;
  return [source.trim(), ...excerpts]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_SOURCE_LENGTH);
}
