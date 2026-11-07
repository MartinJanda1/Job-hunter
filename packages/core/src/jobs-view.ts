import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import type { JobListItem, JobListView, JobMark, JobsResponse } from '@job-hunter/shared'
import type { Db } from './db/client'
import { rowToJob } from './db/client'
import { jobs } from './db/schema'
import { loadCriteria } from './criteria'
import { excerpt, findTerms, toParts } from './highlight'

const LIST_LIMIT = 200

/** Podmínka pro záložku: inbox = vhodné a zatím neoznačené, ostatní = podle označení. */
const viewWhere = (view: JobListView): SQL | undefined =>
  view === 'inbox' ? and(eq(jobs.status, 'matched'), isNull(jobs.mark)) : eq(jobs.mark, view)

/** Seznam nabídek pro UI se zvýrazněnými klíčovými slovy a počty v záložkách. */
export async function listJobs(db: Db, view: JobListView): Promise<JobsResponse> {
  const { keywords } = await loadCriteria(db)

  const rows = await db
    .select()
    .from(jobs)
    .where(viewWhere(view))
    .orderBy(view === 'inbox' ? desc(jobs.foundAt) : desc(jobs.markedAt))
    .limit(LIST_LIMIT)

  const [c] = await db
    .select({
      inbox: sql<number>`count(*) filter (where ${jobs.status} = 'matched' and ${jobs.mark} is null)::int`,
      starred: sql<number>`count(*) filter (where ${jobs.mark} = 'starred')::int`,
      applied: sql<number>`count(*) filter (where ${jobs.mark} = 'applied')::int`,
      hidden: sql<number>`count(*) filter (where ${jobs.mark} = 'hidden')::int`,
    })
    .from(jobs)

  const items: JobListItem[] = rows.map((row) => {
    const { description, ...job } = rowToJob(row)
    const title = findTerms(job.title, keywords)
    const desc = description?.replace(/\s+/g, ' ').trim()
    const body = desc ? findTerms(desc, keywords) : undefined
    return {
      ...job,
      keywords: keywords.filter((k) => title.found.includes(k) || body?.found.includes(k)),
      titleParts: toParts(job.title, title.ranges),
      excerpt: desc && body ? excerpt(desc, body.ranges) : undefined,
    }
  })

  return {
    view,
    jobs: items,
    counts: { inbox: c?.inbox ?? 0, starred: c?.starred ?? 0, applied: c?.applied ?? 0, hidden: c?.hidden ?? 0 },
  }
}

/** Nastaví / zruší (null) ruční označení nabídky. Vrací false, když nabídka neexistuje. */
export async function setJobMark(db: Db, id: string, mark: JobMark | null): Promise<boolean> {
  const updated = await db
    .update(jobs)
    .set({ mark, markedAt: mark ? new Date() : null })
    .where(eq(jobs.id, id))
    .returning({ id: jobs.id })
  return updated.length > 0
}
