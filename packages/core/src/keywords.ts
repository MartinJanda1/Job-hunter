import { asc, eq, sql } from 'drizzle-orm'
import type { FilterSettings, KeywordsResponse } from '@job-hunter/shared'
import type { Db } from './db/client'
import { jobs, keywords } from './db/schema'
import { LOCATIONS, getSettings, loadCriteria, saveSettings } from './criteria'
import { containsTerm, jobLocationMatches, normalize } from './filter'
import { detectLanguage } from './language'
import { refilterIfCriteriaChanged } from './refilter'

/**
 * Klíčová slova se statistikou: u každého slova (i vypnutého) počet nabídek v DB v hledané
 * lokalitě, které ho obsahují – bez ohledu na ostatní slova. Ukazuje, co by zapnutí přineslo.
 */
export async function listKeywords(db: Db): Promise<KeywordsResponse> {
  const criteria = await loadCriteria(db) // naplní výchozí slova, je-li tabulka prázdná
  const rows = await db.select().from(keywords).orderBy(asc(keywords.createdAt), asc(keywords.term))

  const inLocation = (
    await db
      .select({ id: jobs.id, source: jobs.source, title: jobs.title, description: jobs.description, location: jobs.location, dedupeKey: jobs.dedupeKey })
      .from(jobs)
  )
    .filter((j) => jobLocationMatches(j, LOCATIONS))
    .map((j) => ({ ...j, raw: `${j.title} ${j.description ?? ''}`, text: normalize(`${j.title} ${j.description ?? ''}`) }))
  const texts = inLocation.map((j) => j.text)

  // Kolik skupin nabídek (slova + lokalita sedí) je jasně anglicky – tolik skryje „jen česky“
  const englishGroups = new Set(
    inLocation
      .filter((j) => criteria.keywords.some((k) => containsTerm(j.text, k)) && detectLanguage(j.raw) === 'en')
      .map((j) => j.dedupeKey ?? j.id),
  )

  // Vhodné = skupiny duplicit (jako počty v záložkách), ne řádky
  const [counts] = await db
    .select({ matched: sql<number>`count(distinct coalesce(${jobs.dedupeKey}, 'id:' || ${jobs.id}))::int` })
    .from(jobs)
    .where(eq(jobs.status, 'matched'))

  return {
    locations: LOCATIONS,
    matched: counts?.matched ?? 0,
    settings: await getSettings(db),
    englishCount: englishGroups.size,
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

/** Změna nastavení filtru (např. jen česky) – uloží a přepočítá nabídky. */
export async function updateSettings(db: Db, patch: Partial<FilterSettings>): Promise<KeywordsResponse> {
  await saveSettings(db, patch)
  return afterChange(db)
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
