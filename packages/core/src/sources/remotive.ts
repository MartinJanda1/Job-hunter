import type { JobSource, RawJob } from '@job-hunter/shared'
import { HTTP_HEADERS, fetchedNow, htmlToText, isThrottled } from './util'

/**
 * Remotive – remote nabídky přes veřejné API (https://remotive.com/api-documentation).
 * Podmínky API: u nabídky odkazovat na její URL na Remotive a uvádět Remotive jako zdroj
 * (UI zobrazuje zdroj, `url` vede na Remotive); stahovat max. 4× denně → 1× za 6 h.
 * Nabídky jsou v API zpožděné o 24 h.
 */
const API_URL = 'https://remotive.com/api/remote-jobs?category=software-dev'
const MIN_HOURS_BETWEEN_FETCHES = 6

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name?: string
  candidate_required_location?: string
  salary?: string
  description?: string
  publication_date?: string
}

export const remotiveSource: JobSource = {
  name: 'remotive',
  async fetchJobs(_criteria, prevState) {
    if (isThrottled(prevState, MIN_HOURS_BETWEEN_FETCHES)) return { jobs: [] }

    const res = await fetch(API_URL, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`Remotive vrátilo ${res.status}`)
    const data = (await res.json()) as { jobs?: RemotiveJob[] }

    const jobs: RawJob[] = (data.jobs ?? []).map((j) => ({
      id: `remotive:${j.id}`,
      source: 'remotive',
      externalId: String(j.id),
      title: j.title,
      company: j.company_name || undefined,
      location: j.candidate_required_location ? `Remote (${j.candidate_required_location})` : 'Remote',
      remote: true,
      salaryText: j.salary || undefined,
      url: j.url,
      description: htmlToText(j.description),
      // API vrací čas bez časové zóny (UTC)
      publishedAt: j.publication_date ? new Date(`${j.publication_date}Z`).toISOString() : undefined,
    }))

    return { jobs, state: fetchedNow() }
  },
}
