import { createHash } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import type { SearchCriteria } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, sourceState } from './db/schema'
import { FILTER_VERSION, passesHardFilter } from './filter'

/** Klíč v source_state, pod kterým je otisk naposledy použitých kritérií */
const STATE_KEY = '_criteria'
const UPDATE_BATCH = 1000

/** Otisk kritérií + verze logiky filtru (změna kteréhokoli = přepočet) */
const criteriaHash = (c: SearchCriteria) =>
  createHash('sha1').update(JSON.stringify({ filterVersion: FILTER_VERSION, ...c })).digest('hex')

/**
 * Po změně kritérií přepočítá stav všech uložených nabídek ve stavu matched/rejected
 * (rozpracované – drafted, applied… – nechá být). Bez notifikací. Když se kritéria
 * od minula nezměnila, nedělá nic. Vrací počet nabídek, kterým se změnil stav, nebo null.
 */
export async function refilterIfCriteriaChanged(db: Db, criteria: SearchCriteria): Promise<number | null> {
  const hash = criteriaHash(criteria)
  const [prev] = await db.select().from(sourceState).where(eq(sourceState.source, STATE_KEY))
  if (prev?.state.hash === hash) return null

  const rows = await db
    .select({ id: jobs.id, source: jobs.source, title: jobs.title, description: jobs.description, location: jobs.location, remote: jobs.remote, status: jobs.status })
    .from(jobs)
    .where(inArray(jobs.status, ['matched', 'rejected']))

  const toMatched: string[] = []
  const toRejected: string[] = []
  for (const r of rows) {
    const next = passesHardFilter({ source: r.source, title: r.title, description: r.description ?? undefined, location: r.location ?? undefined, remote: r.remote ?? undefined }, criteria)
      ? 'matched'
      : 'rejected'
    if (next !== r.status) (next === 'matched' ? toMatched : toRejected).push(r.id)
  }

  for (const [status, ids] of [['matched', toMatched], ['rejected', toRejected]] as const) {
    for (let i = 0; i < ids.length; i += UPDATE_BATCH) {
      await db.update(jobs).set({ status }).where(inArray(jobs.id, ids.slice(i, i + UPDATE_BATCH)))
    }
  }

  const state = { hash }
  await db
    .insert(sourceState)
    .values({ source: STATE_KEY, state })
    .onConflictDoUpdate({ target: sourceState.source, set: { state, updatedAt: new Date() } })

  console.log(`[refilter] kritéria změněna: ${rows.length} nabídek přepočteno, ${toMatched.length} → matched, ${toRejected.length} → rejected`)
  return toMatched.length + toRejected.length
}
