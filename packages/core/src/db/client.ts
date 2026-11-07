import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { Job } from '@job-hunter/shared'
import * as schema from './schema'
import type { JobRow } from './schema'

/**
 * Drizzle nad Neon HTTP driverem – každý dotaz je jeden HTTP požadavek,
 * žádné držené spojení, takže se hodí do serverless funkcí na Vercelu.
 */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('Chybí DATABASE_URL (lokálně: `vercel env pull .env.local`)')
  return drizzle({ client: neon(url), schema })
}

export type Db = ReturnType<typeof createDb>

/** Řádek z DB → sdílený typ `Job` (datumy jako ISO řetězce, null → undefined) */
export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    source: row.source,
    externalId: row.externalId,
    title: row.title,
    company: row.company ?? undefined,
    location: row.location ?? undefined,
    remote: row.remote ?? undefined,
    salaryText: row.salaryText ?? undefined,
    url: row.url,
    description: row.description ?? undefined,
    publishedAt: row.publishedAt?.toISOString(),
    foundAt: row.foundAt.toISOString(),
    score: row.score ?? undefined,
    scoreReason: row.scoreReason ?? undefined,
    status: row.status,
    mark: row.mark ?? undefined,
  }
}
