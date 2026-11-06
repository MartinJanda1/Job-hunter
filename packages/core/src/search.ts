import type { SearchCriteria, SourceState } from '@job-hunter/shared'
import type { Db } from './db/client'
import { sourceState } from './db/schema'
import { criteria as defaultCriteria } from './criteria'
import { notifyNewMatches, saveJobs, type NewMatch } from './jobs'
import { refilterIfCriteriaChanged } from './refilter'
import { sources } from './sources'

export interface SearchResult {
  found: number    // kolik nabídek vrátily zdroje
  inserted: number // kolik z nich bylo nových (v DB ještě nebyly)
  matched: number  // kolik nových prošlo filtrem
  errors: string[] // zdroje, které selhaly
  refiltered?: number // po změně kritérií: kolika uloženým nabídkám se změnil stav
}

/**
 * Jeden běh hledání: zdroje → filtr → uložení do DB → notifikace.
 * Je idempotentní – opakované nebo souběžné spuštění nic nezdvojí. Stav zdroje (ETag…) se uloží
 * až po úspěšném uložení jeho nabídek, takže při chybě se příště zpracuje znovu.
 */
export async function runSearch(db: Db, criteria: SearchCriteria = defaultCriteria): Promise<SearchResult> {
  const result: SearchResult = { found: 0, inserted: 0, matched: 0, errors: [] }
  const newMatches: NewMatch[] = []

  // Změnila se kritéria (criteria.ts)? Přepočítat i dřív uložené nabídky.
  const refiltered = await refilterIfCriteriaChanged(db, criteria)
  if (refiltered !== null) result.refiltered = refiltered

  const states = new Map<string, SourceState>(
    (await db.select().from(sourceState)).map((r) => [r.source, r.state]),
  )

  for (const source of sources) {
    try {
      const { jobs: found, state } = await source.fetchJobs(criteria, states.get(source.name))
      result.found += found.length

      const saved = await saveJobs(db, found, criteria)
      result.inserted += saved.inserted
      newMatches.push(...saved.newMatches)

      if (state) {
        await db
          .insert(sourceState)
          .values({ source: source.name, state })
          .onConflictDoUpdate({ target: sourceState.source, set: { state, updatedAt: new Date() } })
      }
    } catch (err) {
      console.error(`[search] zdroj ${source.name} selhal:`, err)
      result.errors.push(source.name)
    }
  }

  result.matched = newMatches.length
  await notifyNewMatches(newMatches)

  console.log(`[search] hotovo:`, result)
  return result
}
