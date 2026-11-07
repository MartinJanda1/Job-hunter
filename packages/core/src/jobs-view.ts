import { and, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type { JobListItem, JobListView, JobMark, JobsResponse } from '@job-hunter/shared'
import type { Db } from './db/client'
import { rowToJob } from './db/client'
import { jobs, type JobRow } from './db/schema'
import { loadCriteria } from './criteria'
import { excerpt, findTerms, toParts } from './highlight'

/** Max. počet karet (skupin) v seznamu */
const LIST_LIMIT = 200
/** Kolik řádků načíst, aby po sloučení duplicit zbylo dost skupin */
const ROW_LIMIT = 600

/**
 * Pořadí zdrojů pro výběr hlavní nabídky skupiny: přímé odkazy na portál před agregátorem
 * (Jooble přesměrovává). Nižší index = lepší.
 */
const SOURCE_PRIORITY = ['linkedin', 'jobscz', 'mpsv', 'remotive', 'remoteok', 'rss', 'jooble']

/** Nabídka s nejvíc informacemi: mzda, popis, pak zdroj podle priority */
function richness(r: JobRow): number {
  const prio = SOURCE_PRIORITY.indexOf(r.source)
  return (r.salaryText ? 100 : 0) + (r.description ? 50 : 0) - (prio < 0 ? SOURCE_PRIORITY.length : prio)
}

const groupKey = (r: Pick<JobRow, 'id' | 'dedupeKey'>) => r.dedupeKey ?? `id:${r.id}`
/** Totéž v SQL – počty v záložkách počítají skupiny, ne řádky */
const groupKeySql = sql`coalesce(${jobs.dedupeKey}, 'id:' || ${jobs.id})`

/** Podmínka pro záložku: inbox = vhodné a zatím neoznačené, ostatní = podle označení. */
const viewWhere = (view: JobListView): SQL | undefined =>
  view === 'inbox' ? and(eq(jobs.status, 'matched'), isNull(jobs.mark)) : eq(jobs.mark, view)

/** Seznam nabídek pro UI: jedna karta za skupinu duplicit, zvýrazněná klíčová slova, počty záložek. */
export async function listJobs(db: Db, view: JobListView): Promise<JobsResponse> {
  const { keywords } = await loadCriteria(db)

  const rows = await db
    .select()
    .from(jobs)
    .where(viewWhere(view))
    .orderBy(view === 'inbox' ? desc(jobs.foundAt) : desc(jobs.markedAt))
    .limit(ROW_LIMIT)

  // Skupiny v pořadí první (nejnovější) nabídky
  const groups = new Map<string, JobRow[]>()
  for (const r of rows) {
    const k = groupKey(r)
    if (!groups.has(k) && groups.size >= LIST_LIMIT) continue
    groups.set(k, [...(groups.get(k) ?? []), r])
  }

  // Všichni členové skupin (i mimo záložku, např. vyřazení filtrem) – pro „Také na“
  const dedupeKeys = [...groups.keys()].filter((k) => !k.startsWith('id:'))
  const members = dedupeKeys.length
    ? await db
        .select({ id: jobs.id, source: jobs.source, url: jobs.url, dedupeKey: jobs.dedupeKey })
        .from(jobs)
        .where(inArray(jobs.dedupeKey, dedupeKeys))
    : []
  const membersByKey = new Map<string, typeof members>()
  for (const m of members) membersByKey.set(m.dedupeKey!, [...(membersByKey.get(m.dedupeKey!) ?? []), m])

  const [c] = await db
    .select({
      inbox: sql<number>`count(distinct ${groupKeySql}) filter (where ${jobs.status} = 'matched' and ${jobs.mark} is null)::int`,
      starred: sql<number>`count(distinct ${groupKeySql}) filter (where ${jobs.mark} = 'starred')::int`,
      applied: sql<number>`count(distinct ${groupKeySql}) filter (where ${jobs.mark} = 'applied')::int`,
      hidden: sql<number>`count(distinct ${groupKeySql}) filter (where ${jobs.mark} = 'hidden')::int`,
    })
    .from(jobs)

  const items: JobListItem[] = [...groups.entries()].map(([key, groupRows]) => {
    const primary = groupRows.reduce((best, r) => (richness(r) > richness(best) ? r : best))
    const { description, ...job } = rowToJob(primary)
    const title = findTerms(job.title, keywords)
    const desc = description?.replace(/\s+/g, ' ').trim()
    const body = desc ? findTerms(desc, keywords) : undefined
    const others = (membersByKey.get(key) ?? groupRows)
      .filter((m) => m.id !== primary.id)
      .map(({ id, source, url }) => ({ id, source, url }))
    return {
      ...job,
      keywords: keywords.filter((k) => title.found.includes(k) || body?.found.includes(k)),
      titleParts: toParts(job.title, title.ranges),
      excerpt: desc && body ? excerpt(desc, body.ranges) : undefined,
      others,
    }
  })

  return {
    view,
    jobs: items,
    counts: { inbox: c?.inbox ?? 0, starred: c?.starred ?? 0, applied: c?.applied ?? 0, hidden: c?.hidden ?? 0 },
  }
}

/**
 * Nastaví / zruší (null) ruční označení – celé skupině duplicit, ať se stejný inzerát z jiného zdroje
 * nevrátí do „K prohlédnutí“. Vrací false, když nabídka neexistuje.
 */
export async function setJobMark(db: Db, id: string, mark: JobMark | null): Promise<boolean> {
  const [row] = await db.select({ dedupeKey: jobs.dedupeKey }).from(jobs).where(eq(jobs.id, id))
  if (!row) return false
  await db
    .update(jobs)
    .set({ mark, markedAt: mark ? new Date() : null })
    .where(row.dedupeKey ? eq(jobs.dedupeKey, row.dedupeKey) : eq(jobs.id, id))
  return true
}
