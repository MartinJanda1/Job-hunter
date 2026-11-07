import { eq, isNull, sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { jobs, sourceState } from './db/schema'
import { normalize } from './filter'

/**
 * Slučování duplicit: stejný inzerát z více zdrojů (Jooble agreguje portály, hlídače posílají totéž…).
 * Klíč = normalizovaný název pozice + normalizovaná firma. Lokalita v klíči není (Praha / Praha 8 /
 * Hlavní město Praha…). Bez firmy se neslučuje – klíč je pak unikátní (`id:<id>`).
 *
 * Při změně normalizace zvýšit DEDUPE_VERSION – klíče všech nabídek se při dalším běhu přepočítají.
 */
export const DEDUPE_VERSION = '1'

/** Označení pohlaví v názvu: (m/ž), (M/Ž), (m/f/d), f/m/x, (ž/m)… */
const GENDER = /\(?\s*\b(?:m\s*\/\s*[zf](?:\s*\/\s*[dx])?|[zf]\s*\/\s*m(?:\s*\/\s*[dx])?)\b\s*\)?/g

/** Slova, která se z názvu firmy vynechají (právní formy, „pobočka“, země…) – už normalizovaná */
const COMPANY_STOPWORDS = new Set([
  'sro', 'spol', 'as', 'ks', 'vos', 'sp', 'zs', 'ops', 'zo', 'oo',
  'gmbh', 'ltd', 'limited', 'inc', 'llc', 'ag', 'se', 'plc', 'bv', 'nv', 'sa', 'kft', 'corp', 'co',
  'odstepny', 'zavod', 'organizacni', 'slozka', 'pobocka', 'branch', 'prague',
  'group', 'czech', 'republic', 'czechia', 'cz', 'ceska', 'republika', 'cr',
])

export function normalizeTitle(title: string): string {
  return normalize(title.replace(/\s+@\s+.*$/, '')) // Jooble: „Pozice @ Firma“
    .replace(GENDER, ' ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim()
}

export function normalizeCompany(company: string | null | undefined): string {
  if (!company) return ''
  return normalize(company)
    .replace(/\b([a-z])\.(?=\s*[a-z]\.)/g, '$1') // s.r.o. → sro, a.s. → as (tečky mezi písmeny)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !COMPANY_STOPWORDS.has(t))
    .join(' ')
}

export function dedupeKey(job: { id: string; title: string; company?: string | null }): string {
  const company = normalizeCompany(job.company)
  const title = normalizeTitle(job.title)
  return company && title ? `${title}|${company}` : `id:${job.id}`
}

const STATE_KEY = '_dedupe'
const UPDATE_BATCH = 1000

/**
 * Doplní / přepočítá klíče skupin: při změně DEDUPE_VERSION u všech nabídek, jinak jen u nabídek bez klíče.
 * Pak sjednotí označení ve skupinách (sloučením mohly vzniknout skupiny s různým označením).
 * Vrací počet nabídek, kterým se klíč nastavil.
 */
export async function syncDedupeKeys(db: Db): Promise<number> {
  const [state] = await db.select().from(sourceState).where(eq(sourceState.source, STATE_KEY))
  const all = state?.state.version !== DEDUPE_VERSION

  const rows = await db
    .select({ id: jobs.id, title: jobs.title, company: jobs.company, dedupeKey: jobs.dedupeKey })
    .from(jobs)
    .where(all ? undefined : isNull(jobs.dedupeKey))
  const changed = rows
    .map((r) => ({ id: r.id, key: dedupeKey(r), old: r.dedupeKey }))
    .filter((r) => r.key !== r.old)

  // Jeden UPDATE na dávku přes jsonb_to_recordset (neon-http = každý příkaz je HTTP požadavek)
  for (let i = 0; i < changed.length; i += UPDATE_BATCH) {
    const batch = JSON.stringify(changed.slice(i, i + UPDATE_BATCH).map(({ id, key }) => ({ id, key })))
    await db.execute(sql`
      update ${jobs} set dedupe_key = v.key
      from jsonb_to_recordset(${batch}::jsonb) as v(id text, key text)
      where ${jobs.id} = v.id`)
  }

  if (changed.length) await propagateMarks(db)
  if (all) {
    const s = { version: DEDUPE_VERSION }
    await db
      .insert(sourceState)
      .values({ source: STATE_KEY, state: s })
      .onConflictDoUpdate({ target: sourceState.source, set: { state: s, updatedAt: new Date() } })
  }
  if (changed.length) console.log(`[dedupe] klíč skupiny nastaven ${changed.length} nabídkám (verze ${DEDUPE_VERSION})`)
  return changed.length
}

/**
 * Označení platí pro celou skupinu: nabídky bez označení (nebo se starším) dostanou nejnovější
 * označení ze své skupiny. Volá se po vložení nových nabídek a po přepočtu klíčů.
 */
export async function propagateMarks(db: Db): Promise<void> {
  await db.execute(sql`
    update ${jobs} j set mark = g.mark, marked_at = g.marked_at
    from (
      select distinct on (dedupe_key) dedupe_key, mark, marked_at
      from ${jobs} where mark is not null and dedupe_key is not null
      order by dedupe_key, marked_at desc
    ) g
    where j.dedupe_key = g.dedupe_key and (j.mark is distinct from g.mark)`)
}
