import { createHash } from 'node:crypto'
import type { RawJob } from '@job-hunter/shared'
import { anchors, blockAfter, textPieces } from '../html'
import type { MailParser } from '../parsers'

/**
 * Prace.cz – „Nové pracovní nabídky“ podle uloženého hledání (např. „Odpovězte EKOSPOL a.s. nebo
 * 1 dalšímu“). Karta (text v pořadí): pozice | lokalita | • | firma | • | úvazek | [mzda „… Kč/měsíc“]
 *
 * Odkazy vedou jen přes sledovací přesměrování r.emailing2.prace.cz bez ID nabídky. Neotevíráme je
 * (započítalo by se jako klik uživatele) – ID je otisk pozice + firmy + lokality, odkaz zůstává
 * sledovací (stejně jako klik v Gmailu). Potvrzení hlídače a ověření e-mailu karty nemají → 0 nabídek.
 */
export const praceCzParser: MailParser = {
  source: 'pracecz',
  matches: (mail) => /@prace\.cz\b/i.test(mail.from),
  parse(mail) {
    const links = anchors(mail.html, /^https:\/\/r\.emailing2\.prace\.cz\/tr\/cl\//)
    const jobs = new Map<string, RawJob>()

    links.forEach((link, i) => {
      const pieces = textPieces(blockAfter(mail.html, links, i))
      if (pieces.length < 5 || pieces[2] !== '•' || pieces[4] !== '•') return // není karta nabídky

      const title = pieces[0]!
      const location = pieces[1]!
      const company = pieces[3]!
      const salaryText = pieces.slice(5).find((p) => /Kč/.test(p))

      const externalId = createHash('sha1').update(`${title}|${company}|${location}`).digest('hex').slice(0, 16)
      jobs.set(externalId, {
        id: `pracecz:${externalId}`,
        source: 'pracecz',
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
