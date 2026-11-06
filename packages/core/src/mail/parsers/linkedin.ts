import type { RawJob } from '@job-hunter/shared'
import { anchors, blockAfter, textPieces } from '../html'
import type { MailParser } from '../parsers'

/**
 * LinkedIn – upozornění na pracovní příležitosti (jobalerts-noreply@linkedin.com).
 * Každá nabídka má v e-mailu víc odkazů (logo, název, tlačítko) na /comm/jobs/view/<ID>/ –
 * seskupují se podle ID. Karta (text v pořadí): pozice | firma · lokalita (Hybrid) | …
 * URL se čistí na kanonickou https://www.linkedin.com/jobs/view/<ID>/ (bez sledovacích parametrů).
 */
const JOB_LINK = /linkedin\.com\/comm\/jobs\/view\/(\d+)/

export const linkedInParser: MailParser = {
  source: 'linkedin',
  matches: (mail) => /jobalerts-noreply@linkedin\.com/i.test(mail.from),
  parse(mail) {
    const links = anchors(mail.html, JOB_LINK)
    const jobs = new Map<string, RawJob>()

    links.forEach((link, i) => {
      const externalId = link.href.match(JOB_LINK)![1]!
      if (jobs.has(externalId)) return

      const pieces = textPieces(blockAfter(mail.html, links, i))
      const meta = pieces.findIndex((p) => p.includes(' · '))
      if (meta < 1) return // odkaz bez textu (logo) – nabídku vezme další odkaz se stejným ID

      const title = pieces[meta - 1]!
      const [company, ...rest] = pieces[meta]!.split(' · ')
      jobs.set(externalId, {
        id: `linkedin:${externalId}`,
        source: 'linkedin',
        externalId,
        title,
        company: company?.trim() || undefined,
        location: rest.join(' · ').trim() || undefined,
        url: `https://www.linkedin.com/jobs/view/${externalId}/`,
        publishedAt: mail.date,
      })
    })

    return [...jobs.values()]
  },
}
