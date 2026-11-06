import type { SearchCriteria } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, type NewJobRow } from './db/schema'
import { criteria as defaultCriteria } from './criteria'
import { passesHardFilter } from './filter'
import { notify } from './notify/ntfy'
import { sources } from './sources'

/** Víc nových nabídek najednou se pošle jako jedna souhrnná notifikace, ať telefon nezahltíme. */
const MAX_SINGLE_NOTIFICATIONS = 3

export interface SearchResult {
  found: number    // kolik nabídek vrátily zdroje
  inserted: number // kolik z nich bylo nových (v DB ještě nebyly)
  matched: number  // kolik nových prošlo filtrem
  errors: string[] // zdroje, které selhaly
}

/**
 * Jeden běh hledání: zdroje → filtr → uložení do DB → notifikace.
 * Je idempotentní – nabídka, která už v DB je, se přeskočí (ON CONFLICT DO NOTHING),
 * takže opakované nebo souběžné spuštění nic nezdvojí.
 */
export async function runSearch(db: Db, criteria: SearchCriteria = defaultCriteria): Promise<SearchResult> {
  const result: SearchResult = { found: 0, inserted: 0, matched: 0, errors: [] }
  const newMatches: { title: string; company: string | null; source: string; url: string }[] = []

  for (const source of sources) {
    let found
    try {
      found = await source.fetchJobs(criteria)
    } catch (err) {
      console.error(`[search] zdroj ${source.name} selhal:`, err)
      result.errors.push(source.name)
      continue
    }
    result.found += found.length
    if (found.length === 0) continue

    const rows: NewJobRow[] = found.map((raw) => ({
      ...raw,
      publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
      status: passesHardFilter(raw, criteria) ? 'matched' : 'rejected',
    }))

    const inserted = await db
      .insert(jobs)
      .values(rows)
      .onConflictDoNothing({ target: jobs.id })
      .returning({ status: jobs.status, title: jobs.title, company: jobs.company, source: jobs.source, url: jobs.url })

    result.inserted += inserted.length
    newMatches.push(...inserted.filter((j) => j.status === 'matched'))
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
