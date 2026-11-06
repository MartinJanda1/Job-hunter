import type { Job, SearchCriteria } from '@job-hunter/shared'

/** 1. krok: rychlý filtr podle pevných kritérií (bez AI) */
export function passesHardFilter(job: Pick<Job, 'title' | 'description' | 'location'>, c: SearchCriteria): boolean {
  const text = `${job.title} ${job.description ?? ''} ${job.location ?? ''}`.toLowerCase()

  if (c.excludeKeywords?.some((k) => text.includes(k.toLowerCase()))) return false
  if (!c.keywords.some((k) => text.includes(k.toLowerCase()))) return false
  if (c.remoteOnly && !text.includes('remote')) return false

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
