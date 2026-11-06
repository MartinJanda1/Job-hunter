import type { SearchCriteria, SourceState } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, sourceState, type NewJobRow } from './db/schema'
import { criteria as defaultCriteria } from './criteria'
import { passesHardFilter } from './filter'
import { notify } from './notify/ntfy'
import { sources } from './sources'

/** Víc nových nabídek najednou se pošle jako jedna souhrnná notifikace, ať telefon nezahltíme. */
const MAX_SINGLE_NOTIFICATIONS = 3
/** Velikost dávky pro INSERT (limit parametrů Postgresu je 65 535; 15 sloupců × 500 je bezpečně pod ním) */
const INSERT_BATCH = 500

export interface SearchResult {
  found: number    // kolik nabídek vrátily zdroje
  inserted: number // kolik z nich bylo nových (v DB ještě nebyly)
  matched: number  // kolik nových prošlo filtrem
  errors: string[] // zdroje, které selhaly
}

type NewMatch = { title: string; company: string | null; source: string; url: string }

/**
 * Jeden běh hledání: zdroje → filtr → uložení do DB → notifikace.
 * Je idempotentní – nabídka, která už v DB je, se přeskočí (ON CONFLICT DO NOTHING),
 * takže opakované nebo souběžné spuštění nic nezdvojí. Stav zdroje (ETag…) se uloží
 * až po úspěšném uložení jeho nabídek, takže při chybě se příště zpracuje znovu.
 */
export async function runSearch(db: Db, criteria: SearchCriteria = defaultCriteria): Promise<SearchResult> {
  const result: SearchResult = { found: 0, inserted: 0, matched: 0, errors: [] }
  const newMatches: NewMatch[] = []

  const states = new Map<string, SourceState>(
    (await db.select().from(sourceState)).map((r) => [r.source, r.state]),
  )

  for (const source of sources) {
    try {
      const { jobs: found, state } = await source.fetchJobs(criteria, states.get(source.name))
      result.found += found.length

      const rows: NewJobRow[] = found.map((raw) => ({
        ...raw,
        publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
        status: passesHardFilter(raw, criteria) ? 'matched' : 'rejected',
      }))

      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const inserted = await db
          .insert(jobs)
          .values(rows.slice(i, i + INSERT_BATCH))
          .onConflictDoNothing({ target: jobs.id })
          .returning({ status: jobs.status, title: jobs.title, company: jobs.company, source: jobs.source, url: jobs.url })
        result.inserted += inserted.length
        newMatches.push(...inserted.filter((j) => j.status === 'matched'))
      }

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

  if (newMatches.length > MAX_SINGLE_NOTIFICATIONS) {
    await notify(`${newMatches.length} nových nabídek`, newMatches.map((j) => `• ${j.title}`).join('\n'))
  } else {
    for (const j of newMatches) await notify(`Nová nabídka: ${j.title}`, j.company ?? j.source, j.url)
  }

  console.log(`[search] hotovo:`, result)
  return result
}
