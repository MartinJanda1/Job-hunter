import type { Job, SearchCriteria } from '@job-hunter/shared'

/** Malá písmena bez diakritiky – „Kodér“ i „koder“ se porovnají stejně. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Další zápisy lokalit (klíč i hodnoty normalizované) */
const LOCATION_ALIASES: Record<string, string[]> = {
  praha: ['praha', 'prague', 'prag'],
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const patternCache = new Map<string, RegExp>()

/** Regex pro celé slovo/frázi v normalizovaném textu („vue“ ano ve „Vue.js“, ne v „revue“). */
function wordPattern(term: string): RegExp {
  let re = patternCache.get(term)
  if (!re) {
    re = new RegExp(`(?<![a-z0-9])${escapeRegExp(normalize(term))}(?![a-z0-9])`)
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

/** 1. krok: rychlý filtr podle pevných kritérií (bez AI) */
export function passesHardFilter(job: Pick<Job, 'title' | 'description' | 'location'>, c: SearchCriteria): boolean {
  const text = normalize(`${job.title} ${job.description ?? ''}`)

  if (c.excludeKeywords?.length && containsAny(text, c.excludeKeywords)) return false
  if (!containsAny(text, c.keywords)) return false
  if (!locationMatches(job.location, c.locations)) return false
  if (c.remoteOnly && !containsAny(normalize(`${text} ${job.location ?? ''}`), ['remote'])) return false

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
