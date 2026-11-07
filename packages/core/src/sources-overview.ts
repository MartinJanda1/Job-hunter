import { sql } from 'drizzle-orm'
import { SOURCES, type SourceView } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, sourceState } from './db/schema'

/** Přehled zdrojů pro UI: popis (SOURCES) + počty nabídek a poslední aktivita z DB. */
export async function sourcesOverview(db: Db): Promise<SourceView[]> {
  const stats = await db
    .select({
      source: jobs.source,
      total: sql<number>`count(*)::int`,
      matched: sql<number>`count(*) filter (where ${jobs.status} = 'matched')::int`,
      lastFoundAt: sql<string | null>`max(${jobs.foundAt})`,
    })
    .from(jobs)
    .groupBy(jobs.source)
  const byKey = new Map(stats.map((s) => [s.source, s]))
  const states = new Map((await db.select().from(sourceState)).map((s) => [s.source, s.updatedAt]))

  return Object.entries(SOURCES).map(([key, info]) => {
    const s = byKey.get(key)
    return {
      key,
      ...info,
      total: s?.total ?? 0,
      matched: s?.matched ?? 0,
      lastFoundAt: s?.lastFoundAt ? new Date(s.lastFoundAt).toISOString() : undefined,
      lastCheckedAt: states.get(key)?.toISOString(),
    }
  })
}
