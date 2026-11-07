import { asc } from 'drizzle-orm'
import type { FilterSettings, SearchCriteria } from '@job-hunter/shared'
import type { Db } from './db/client'
import { keywords, settings } from './db/schema'

/** Výchozí nastavení filtru (dokud ho uživatel nezmění v UI) */
export const DEFAULT_SETTINGS: FilterSettings = { czechOnly: false }

export async function getSettings(db: Db): Promise<FilterSettings> {
  const rows = await db.select().from(settings)
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored } as FilterSettings
}

export async function saveSettings(db: Db, patch: Partial<FilterSettings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
  }
}

/** Lokalita – zatím pevně v kódu (nabídka bez lokality nebo s jinou neprojde; aliasy ve filter.ts). */
export const LOCATIONS = ['Praha']

/**
 * Výchozí klíčová slova – vloží se do prázdné tabulky `keywords` při prvním načtení.
 * Zapnutá = zásadní výrazy podle CV; vypnutá = návrhy, které si uživatel zapne v UI podle statistiky.
 * Porovnává se bez ohledu na velikost písmen a diakritiku, po celých slovech („vue“ nenajde „revue“).
 */
export const DEFAULT_KEYWORDS: { term: string; enabled: boolean }[] = [
  ...['vue', 'vuejs', 'nuxt', 'frontend', 'front-end', 'front end', 'javascript', 'typescript', 'kodér', 'webmaster']
    .map((term) => ({ term, enabled: true })),
  ...[
    'html', 'css', 'sass', 'tailwind', 'bootstrap', 'vite', 'pinia',
    'react', 'angular', 'next.js', 'node.js', 'electron',
    'fullstack', 'full-stack', 'web developer', 'webový vývojář', 'ui developer', 'design system',
    'programátor', 'postgresql', 'docker',
  ].map((term) => ({ term, enabled: false })),
]

/** Kritéria z DB (zapnutá klíčová slova) + lokalita z kódu. Prázdnou tabulku naplní výchozími slovy. */
export async function loadCriteria(db: Db): Promise<SearchCriteria> {
  let rows = await db.select().from(keywords).orderBy(asc(keywords.createdAt), asc(keywords.term))
  if (!rows.length) {
    await db.insert(keywords).values(DEFAULT_KEYWORDS).onConflictDoNothing()
    rows = await db.select().from(keywords).orderBy(asc(keywords.createdAt), asc(keywords.term))
  }
  const { czechOnly } = await getSettings(db)
  return {
    keywords: rows.filter((r) => r.enabled).map((r) => r.term),
    locations: LOCATIONS,
    remoteOnly: false,
    excludeKeywords: [],
    czechOnly,
  }
}
