import type { JobSource, RawJob } from '@job-hunter/shared'
import { HTTP_HEADERS, htmlToText, isThrottled } from './util'

/**
 * Jooble – agregátor nabídek, oficiální REST API (klíč na žádost, JOOBLE_API_KEY).
 * Klíč je vázaný na zemi: český klíč funguje jen na cz.jooble.org (klíč z jooble.org = jen USA).
 * Agreguje i portály bez vlastního veřejného přístupu (NoFluffJobs, JobStack, StartupJobs, Cocuma…).
 *
 * Šetříme dotazy (bezplatný klíč má podle neoficiálních zdrojů jen ~500 dotazů celkem):
 * 1× denně, víc klíčových slov v jednom dotazu (čárka = „nebo“), 100 nabídek na stránku,
 * po prvním běhu jen nové nabídky (datecreatedfrom). Počet dotazů se ukládá do stavu zdroje.
 */
const API_HOST = 'https://cz.jooble.org/api/'
const MIN_HOURS_BETWEEN_FETCHES = 20
const PAGE_SIZE = 100
const MAX_PAGES = 3
const WARN_AT_REQUESTS = 400

interface JoobleJob {
  id: string // přes JSON.parse source text – číslo by přesáhlo Number.MAX_SAFE_INTEGER
  title?: string
  location?: string
  snippet?: string
  salary?: string
  source?: string
  type?: string
  link?: string
  company?: string
  updated?: string
}

export const joobleSource: JobSource = {
  name: 'jooble',
  async fetchJobs(criteria, prevState) {
    const key = process.env.JOOBLE_API_KEY
    if (!key) return { jobs: [] } // bez klíče zdroj tiše přeskočit
    if (!criteria.keywords.length) return { jobs: [] } // bez zapnutých slov by dotaz vrátil vše
    if (isThrottled(prevState, MIN_HOURS_BETWEEN_FETCHES)) return { jobs: [] }

    let requests = Number(prevState?.requests ?? 0)
    // Po prvním běhu jen nabídky od posledního stažení (s dnem rezervy kvůli časovým zónám).
    const since = prevState?.fetchedAt
      ? new Date(Date.parse(prevState.fetchedAt) - 86_400_000).toISOString().slice(0, 10)
      : undefined

    const jobs = new Map<string, RawJob>()
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${API_HOST}${key}`, {
        method: 'POST',
        headers: { ...HTTP_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: criteria.keywords.join(', '),
          // Jedna lokalita → hledat rovnou v ní (méně šumu); víc lokalit → celá ČR a vyfiltruje se u nás.
          location: criteria.locations.length === 1 ? criteria.locations[0] : '',
          page: String(page),
          ResultOnPage: String(PAGE_SIZE),
          ...(since && { datecreatedfrom: since }),
        }),
        signal: AbortSignal.timeout(30_000),
      })
      requests++
      if (!res.ok) throw new Error(`Jooble vrátilo ${res.status} (zkontroluj, že JOOBLE_API_KEY je český klíč)`)

      // ID jako text: reviver s přístupem ke zdrojovému textu (Node 21+), jinak by se zaokrouhlilo.
      const data = JSON.parse(await res.text(), (k, v, ctx?: { source?: string }) =>
        k === 'id' && typeof v === 'number' && ctx?.source ? ctx.source : v,
      ) as { totalCount?: number; jobs?: JoobleJob[] }

      for (const j of data.jobs ?? []) {
        if (!j.id || !j.title || !j.link) continue
        jobs.set(j.id, {
          id: `jooble:${j.id}`,
          source: 'jooble',
          externalId: j.id,
          title: htmlToText(j.title) ?? j.title,
          company: j.company || undefined,
          location: j.location || undefined,
          salaryText: j.salary || undefined,
          url: j.link,
          description: htmlToText(j.snippet),
          // API vrací čas bez časové zóny
          publishedAt: j.updated ? new Date(`${j.updated.slice(0, 23)}Z`).toISOString() : undefined,
        })
      }

      if (page * PAGE_SIZE >= (data.totalCount ?? 0)) break
    }

    if (requests >= WARN_AT_REQUESTS) console.warn(`[jooble] spotřebováno ${requests} dotazů API – blíží se limit`)
    console.log(`[jooble] ${jobs.size} nabídek, celkem dotazů: ${requests}`)
    return { jobs: [...jobs.values()], state: { fetchedAt: new Date().toISOString(), requests: String(requests) } }
  },
}
