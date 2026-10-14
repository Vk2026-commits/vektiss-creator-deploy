import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('retains three rounds of sources while still bounding checkpoint storage', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table creator_research_jobs(provider_metadata jsonb
      constraint creator_research_jobs_provider_metadata_check
      check(jsonb_typeof(provider_metadata)='object' and pg_column_size(provider_metadata)<100000));`);
    const checkpoint = { round: 3, accumulatedSources: Array.from({ length: 270 }, (_, i) => ({
      providerSourceId: i + 1, url: `https://www.youtube.com/shorts/clip-${i}`,
      title: `Source ${i}`, snippet: 'source evidence '.repeat(75),
    })) };
    await expect(db.query('insert into creator_research_jobs values($1)', [checkpoint])).rejects.toThrow();
    await db.exec(await readFile(new URL('../supabase/migrations/202610130002_research_round_storage.sql', import.meta.url), 'utf8'));
    await db.query('insert into creator_research_jobs values($1)', [checkpoint]);
    expect((await db.query('select jsonb_array_length(provider_metadata->\'accumulatedSources\') as count from creator_research_jobs')).rows).toEqual([{ count: 270 }]);
    await expect(db.query('insert into creator_research_jobs values($1)', [{ excessive: 'x'.repeat(1000000) }])).rejects.toThrow();
    await expect(db.query('insert into creator_research_jobs values($1)', [[]])).rejects.toThrow();
  } finally { await db.close(); }
});
