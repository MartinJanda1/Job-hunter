import { asc, eq, sql } from 'drizzle-orm'
import type { KeywordsResponse } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, keywords } from './db/schema'
import { LOCATIONS, loadCriteria } from './criteria'
import { containsTerm, locationMatches, normalize } from './filter'
import { refilterIfCriteriaChanged } from './refilter'

/**
 * Klíčová slova se statistikou: u každého slova (i vypnutého) počet nabídek v DB v hledané
 * lokalitě, které ho obsahují – bez ohledu na ostatní slova. Ukazuje, co by zapnutí přineslo.
 */
export async function listKeywords(db: Db): Promise<KeywordsResponse> {
  await loadCriteria(db) // naplní výchozí slova, je-li tabulka prázdná
  const rows = await db.select().from(keywords).orderBy(asc(keywords.createdAt), asc(keywords.term))

  const texts = (
    await db.select({ title: jobs.title, description: jobs.description, location: jobs.location }).from(jobs)
  )
    .filter((j) => locationMatches(j.location ?? undefined, LOCATIONS))
    .map((j) => normalize(`${j.title} ${j.description ?? ''}`))

  const [counts] = await db
    .select({ matched: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.status, 'matched'))

  return {
    locations: LOCATIONS,
    matched: counts?.matched ?? 0,
    keywords: rows.map((r) => ({
      term: r.term,
      enabled: r.enabled,
      count: texts.reduce((n, t) => n + (containsTerm(t, r.term) ? 1 : 0), 0),
    })),
  }
}

/** Po změně slov přepočítat stav uložených nabídek (refilter pozná změnu podle otisku kritérií). */
async function afterChange(db: Db): Promise<KeywordsResponse> {
  await refilterIfCriteriaChanged(db, await loadCriteria(db))
  return listKeywords(db)
}

/** Ověří nové slovo; vrací chybovou zprávu, nebo upravené slovo. */
export async function validateNewKeyword(db: Db, input: unknown): Promise<string | { term: string }> {
  const term = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : ''
  if (term.length < 2 || term.length > 50) return 'Klíčové slovo musí mít 2–50 znaků'
  if (!/[\p{L}\p{N}]/u.test(term)) return 'Klíčové slovo musí obsahovat písmeno nebo číslici'
  const existing = await db.select({ term: keywords.term }).from(keywords)
  if (existing.some((k) => normalize(k.term) === normalize(term))) return `„${term}“ už v seznamu je`
  return { term }
}

export async function addKeyword(db: Db, term: string): Promise<KeywordsResponse> {
  await db.insert(keywords).values({ term, enabled: true }).onConflictDoNothing()
  return afterChange(db)
}

export async function setKeywordEnabled(db: Db, term: string, enabled: boolean): Promise<KeywordsResponse | null> {
  const updated = await db.update(keywords).set({ enabled }).where(eq(keywords.term, term)).returning()
  return updated.length ? afterChange(db) : null
}

export async function deleteKeyword(db: Db, term: string): Promise<KeywordsResponse | null> {
  const deleted = await db.delete(keywords).where(eq(keywords.term, term)).returning()
  return deleted.length ? afterChange(db) : null
}
