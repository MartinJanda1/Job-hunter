import type { JobSource, RawJob } from '@job-hunter/shared'
import { HTTP_HEADERS, fetchedNow, fixMojibake, htmlToText, isThrottled } from './util'

/**
 * Remote OK – remote nabídky přes veřejné API (https://remoteok.com/api).
 * Podmínky API: odkazovat na URL nabídky na Remote OK (bez nofollow) a uvádět „Remote OK“ jako zdroj;
 * nepoužívat jejich logo. Frekvenci držíme stejně ohleduplnou jako u Remotive (1× za 6 h).
 */
const API_URL = 'https://remoteok.com/api'
const MIN_HOURS_BETWEEN_FETCHES = 6

interface RemoteOkJob {
  id?: string
  slug?: string
  url?: string
  position?: string
  company?: string
  location?: string
  salary_min?: number
  salary_max?: number
  description?: string
  date?: string
  legal?: string // první prvek pole jsou podmínky API, ne nabídka
}

function salaryText(j: RemoteOkJob): string | undefined {
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`
  if (j.salary_min && j.salary_max) return `${fmt(j.salary_min)} – ${fmt(j.salary_max)} / rok`
  if (j.salary_min || j.salary_max) return `${fmt((j.salary_min || j.salary_max)!)} / rok`
  return undefined
}

export const remoteOkSource: JobSource = {
  name: 'remoteok',
  async fetchJobs(_criteria, prevState) {
    if (isThrottled(prevState, MIN_HOURS_BETWEEN_FETCHES)) return { jobs: [] }

    const res = await fetch(API_URL, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`Remote OK vrátilo ${res.status}`)
    const data = (await res.json()) as RemoteOkJob[]

    const jobs: RawJob[] = data
      .filter((j) => j.id && j.position && !j.legal)
      // API posílá ne-ASCII znaky dvojitě zakódované → fixMojibake na všechny texty
      .map((j) => ({
        id: `remoteok:${j.id}`,
        source: 'remoteok',
        externalId: j.id!,
        title: fixMojibake(j.position!),
        company: fixMojibake(j.company) || undefined,
        location: j.location ? `Remote (${fixMojibake(j.location)})` : 'Remote',
        remote: true,
        salaryText: salaryText(j),
        url: j.url || `https://remoteok.com/remote-jobs/${j.slug ?? j.id}`,
        description: htmlToText(fixMojibake(j.description)),
        publishedAt: j.date ? new Date(j.date).toISOString() : undefined,
      }))

    return { jobs, state: fetchedNow() }
  },
}
