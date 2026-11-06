import { createHash } from 'node:crypto'
import type { RawJob } from '@job-hunter/shared'
import { anchors, blockAfter, textPieces } from '../html'
import type { MailParser } from '../parsers'

/**
 * Jobs.cz – e-maily z uložených hledání („60 nových nabídek práce, například u …“).
 * Karta nabídky (text v pořadí): pozice | [mzda „… Kč“] | [štítky, např. „Odpověď do 2 týdnů“] | firma | • | lokalita
 *
 * Odkazy vedou přes sledovací přesměrování track.jobs.cz bez ID nabídky. Neotevíráme je
 * (započítalo by se jako klik uživatele) – ID je otisk pozice + firmy + lokality, odkaz zůstává
 * sledovací (stejně jako klik v Gmailu). Ostatní e-maily (např. „Hlásíme doručení vaší odpovědi“)
 * karty nemají → 0 nabídek.
 */
export const jobsCzParser: MailParser = {
  source: 'jobscz',
  matches: (mail) => /@jobs\.cz\b/i.test(mail.from),
  parse(mail) {
    const links = anchors(mail.html, /^https:\/\/track\.jobs\.cz\//)
    const jobs = new Map<string, RawJob>()

    links.forEach((link, i) => {
      const pieces = textPieces(blockAfter(mail.html, links, i))
      const bullet = pieces.indexOf('•')
      if (bullet < 2) return // není karta nabídky (logo, patička, odkazy na nastavení…)

      const title = pieces[0]!
      const company = pieces[bullet - 1]!
      const location = pieces[bullet + 1]
      const salaryText = pieces.slice(1, bullet - 1).find((p) => /Kč/.test(p))

      const externalId = createHash('sha1').update(`${title}|${company}|${location ?? ''}`).digest('hex').slice(0, 16)
      jobs.set(externalId, {
        id: `jobscz:${externalId}`,
        source: 'jobscz',
        externalId,
        title,
        company,
        location,
        salaryText,
        url: link.href,
        publishedAt: mail.date,
      })
    })

    return [...jobs.values()]
  },
}
