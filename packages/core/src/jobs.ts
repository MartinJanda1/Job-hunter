import { inArray } from 'drizzle-orm'
import type { RawJob, SearchCriteria } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, type NewJobRow } from './db/schema'
import { dedupeKey, propagateMarks } from './dedupe'
import { passesHardFilter } from './filter'
import { notify } from './notify/ntfy'

/** Velikost dávky pro INSERT (limit parametrů Postgresu je 65 535; 16 sloupců × 500 je bezpečně pod ním) */
const INSERT_BATCH = 500
/** Víc nových nabídek najednou se pošle jako jedna souhrnná notifikace, ať telefon nezahltíme. */
const MAX_SINGLE_NOTIFICATIONS = 3

export type NewMatch = { title: string; company: string | null; source: string; url: string }

/**
 * Filtr + uložení nabídek. Idempotentní: nabídka, která už v DB je, se přeskočí (ON CONFLICT DO NOTHING).
 * Duplicity (stejný inzerát z jiného zdroje, viz dedupe.ts) se uloží, ale převezmou označení své
 * skupiny a do `newMatches` (notifikace) se nedostanou.
 */
export async function saveJobs(db: Db, found: RawJob[], criteria: SearchCriteria) {
  const rows: NewJobRow[] = found.map((raw) => ({
    ...raw,
    publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
    status: passesHardFilter(raw, criteria) ? 'matched' : 'rejected',
    dedupeKey: dedupeKey(raw),
  }))

  let inserted = 0
  const newMatches: NewMatch[] = []
  const notifiedKeys = new Set<string>()

  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const chunk = rows.slice(i, i + INSERT_BATCH)
    // Skupiny, které v DB už jsou (z dřívějška nebo z jiného zdroje) – jejich nové kopie se nenotifikují.
    const keys = [...new Set(chunk.map((r) => r.dedupeKey!))]
    const existing = new Set(
      (await db.selectDistinct({ key: jobs.dedupeKey }).from(jobs).where(inArray(jobs.dedupeKey, keys))).map((r) => r.key),
    )

    const batch = await db
      .insert(jobs)
      .values(chunk)
      .onConflictDoNothing({ target: jobs.id })
      .returning({ status: jobs.status, title: jobs.title, company: jobs.company, source: jobs.source, url: jobs.url, dedupeKey: jobs.dedupeKey })
    inserted += batch.length

    for (const j of batch) {
      if (j.status !== 'matched' || existing.has(j.dedupeKey) || notifiedKeys.has(j.dedupeKey!)) continue
      notifiedKeys.add(j.dedupeKey!)
      newMatches.push(j)
    }
  }

  // Nové kopie skrytých / označených inzerátů převezmou označení skupiny.
  if (inserted) await propagateMarks(db)
  return { inserted, newMatches }
}

/** Notifikace o nových vhodných nabídkách (víc než 3 = jedna souhrnná) */
export async function notifyNewMatches(newMatches: NewMatch[]): Promise<void> {
  if (newMatches.length > MAX_SINGLE_NOTIFICATIONS) {
    await notify(`${newMatches.length} nových nabídek`, newMatches.map((j) => `• ${j.title}`).join('\n'))
  } else {
    for (const j of newMatches) await notify(`Nová nabídka: ${j.title}`, j.company ?? j.source, j.url)
  }
}
