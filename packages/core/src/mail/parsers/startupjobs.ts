import type { RawJob } from '@job-hunter/shared'
import { anchors, decodeEntities, textPieces } from '../html'
import type { MailParser } from '../parsers'

/**
 * StartupJobs – „Nové nabídky z vašich sledovaných hledání“ a „Nabídky práce na míru“
 * (jobot@startupjobs.cz). Karta: `<span>firma</span> <a href="…/nabidka/<ID>/<slug>?utm_…">pozice</a>`,
 * firma tedy stojí před odkazem. Lokalitu ani mzdu e-mail neobsahuje (občas je jen v názvu pozice).
 * URL se čistí na kanonickou https://www.startupjobs.cz/nabidka/<ID>/<slug> (bez utm parametrů).
 */
const JOB_LINK = /^\s*https:\/\/www\.startupjobs\.cz\/nabidka\/(\d+)(\/[^?#\s]*)?/

export const startupJobsParser: MailParser = {
  source: 'startupjobs',
  matches: (mail) => /@startupjobs\.cz\b/i.test(mail.from),
  parse(mail) {
    const jobs = new Map<string, RawJob>()

    for (const link of anchors(mail.html, JOB_LINK)) {
      const [, externalId, slug = ''] = link.href.match(JOB_LINK)!
      if (jobs.has(externalId!)) continue

      const end = mail.html.indexOf('</a>', link.index)
      const title = textPieces(mail.html.slice(link.index, end === -1 ? undefined : end)).join(' ')
      if (!title) continue // odkaz bez textu (logo)

      const before = mail.html.slice(Math.max(0, link.index - 1000), link.index)
      const company = before.match(/<span\b[^>]*>([^<]*)<\/span>\s*$/i)?.[1]

      jobs.set(externalId!, {
        id: `startupjobs:${externalId}`,
        source: 'startupjobs',
        externalId: externalId!,
        title,
        company: company ? decodeEntities(company).trim() || undefined : undefined,
        url: `https://www.startupjobs.cz/nabidka/${externalId}${slug}`,
        publishedAt: mail.date,
      })
    }

    return [...jobs.values()]
  },
}
