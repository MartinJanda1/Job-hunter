import { SOURCES, type Job, type SearchCriteria } from '@job-hunter/shared'
import { detectLanguage } from './language'
import { normalize } from './text'

export { normalize }

/** Další zápisy lokalit (klíč i hodnoty normalizované) */
const LOCATION_ALIASES: Record<string, string[]> = {
  praha: ['praha', 'prague', 'prag'],
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const patternCache = new Map<string, RegExp>()

/** Zdroj regexu pro celé slovo/frázi v normalizovaném textu („vue“ ano ve „Vue.js“, ne v „revue“). */
export const termPatternSource = (term: string) => `(?<![a-z0-9])${escapeRegExp(normalize(term))}(?![a-z0-9])`

function wordPattern(term: string): RegExp {
  let re = patternCache.get(term)
  if (!re) {
    re = new RegExp(termPatternSource(term))
    patternCache.set(term, re)
  }
  return re
}

/** Obsahuje (už normalizovaný) text výraz jako celé slovo/frázi? */
export const containsTerm = (normalizedText: string, term: string) => wordPattern(term).test(normalizedText)

const containsAny = (text: string, terms: string[]) => terms.some((t) => containsTerm(text, t))

export function locationMatches(location: string | undefined, locations: string[]): boolean {
  if (!locations.length) return true
  if (!location) return false
  const loc = normalize(location)
  return locations.some((l) => containsAny(loc, LOCATION_ALIASES[normalize(l)] ?? [l]))
}

/**
 * Verze logiky filtru – je součástí otisku kritérií v refilter.ts. Po změně chování filtru
 * (ne kritérií) ji zvýšit, aby se uložené nabídky přepočítaly. Ověřit `npm run filter:dryrun`.
 */
export const FILTER_VERSION = 2

type LocatedJob = { source: string; location?: string | null; remote?: boolean | null }

/** Výrazy v lokalitě, které znamenají práci na dálku („Remote (Worldwide)“, „Česko (Remote)“…). Hybrid ne. */
const REMOTE_LOCATION_TERMS = ['remote', 'na dalku']

/** Remote nabídka: příznak od zdroje, celý zdroj je remote, nebo to říká lokalita */
export function isRemoteJob(job: LocatedJob): boolean {
  if (job.remote || SOURCES[job.source]?.allRemote) return true
  return !!job.location && containsAny(normalize(job.location), REMOTE_LOCATION_TERMS)
}

/**
 * Lokalita nabídky včetně zdroje: remote nabídky projdou vždy (práce na dálku jde odkudkoli);
 * hlídače, které lokalitu filtrují už na portálu a v e-mailu ji neuvádějí
 * (`SOURCES[…].locationPrefiltered`), projdou i bez lokality.
 */
export function jobLocationMatches(job: LocatedJob, locations: string[]): boolean {
  if (isRemoteJob(job)) return true
  if (!job.location && SOURCES[job.source]?.locationPrefiltered) return true
  return locationMatches(job.location ?? undefined, locations)
}

/** 1. krok: rychlý filtr podle pevných kritérií (bez AI) */
export function passesHardFilter(job: Pick<Job, 'source' | 'title' | 'description' | 'location' | 'remote'>, c: SearchCriteria): boolean {
  const text = normalize(`${job.title} ${job.description ?? ''}`)

  if (c.excludeKeywords?.length && containsAny(text, c.excludeKeywords)) return false
  if (!containsAny(text, c.keywords)) return false
  if (!jobLocationMatches(job, c.locations)) return false
  if (c.remoteOnly && !containsAny(normalize(`${text} ${job.location ?? ''}`), ['remote'])) return false
  // Jen česky: vyřadit jen jasně anglické inzeráty; nejasné (např. jen anglický název z hlídače) projdou.
  if (c.czechOnly && detectLanguage(`${job.title} ${job.description ?? ''}`) === 'en') return false

  return true
}

/**
 * 2. krok (TODO): hodnocení shody s CV přes Claude API.
 * Načtěte text CV z process.env.CV_URL, pošlete ho spolu s popisem nabídky
 * a nechte model vrátit JSON { score: 0–100, reason: string }.
 */
export async function scoreAgainstCv(_job: Job): Promise<{ score: number; reason: string } | null> {
  return null
}
