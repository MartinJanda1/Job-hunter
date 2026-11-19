import type { RawJob } from '@job-hunter/shared'
import { anchors, textPieces } from '../html'
import type { MailParser } from '../parsers'

/** Řádek se stářím nabídky ukončuje kartu: „Právě zveřejněno“, „před 2 dny“, „Nové“… */
const AGE = /^(právě zveřejněno|dnes|včera|nové|před \d+|více než \d+|aktivní)/i
const SALARY = /Kč|€|\$|za (hodinu|měsíc|rok|den)/i

/**
 * Indeed – e-mail „Vaše upozornění na nové pracovní nabídky“ (jobalert.indeed.com). Karta (text v pořadí):
 * pozice | firma | lokalita | [mzda „170 000 Kč za měsíc“] | stáří („před 2 dny“, „Právě zveřejněno“).
 * Každá karta má jeden odkaz `…/rc/clk/dl?jk=ID…` (sledovací, s ID nabídky `jk`), ve stejném pořadí jako karty.
 * Z `jk` skládáme čistý odkaz na detail (viewjob), sledovací odkaz neukládáme ani neotevíráme.
 * E-maily bez seznamu („upozornění bylo aktivováno“) nabídky nemají → 0 nabídek.
 */
export const indeedParser: MailParser = {
  source: 'indeed',
  matches: (mail) => /@(\w+\.)*indeed\.com\b/i.test(mail.from),
  parse(mail) {
    const pieces = textPieces(mail.html)
    const start = pieces.findIndex((p) => /^Tyto nabídky práce odpovídají/i.test(p))
    if (start < 0) return []
    let end = pieces.findIndex((p, i) => i > start && /^Zobrazit (všechny pozice|nabídky)/i.test(p))
    if (end < 0) end = pieces.length

    const ids = anchors(mail.html, /\/rc\/clk\//)
      .map((a) => /[?&]jk=([0-9a-f]+)/i.exec(a.href)?.[1])
      .filter((id): id is string => !!id)

    const jobs = new Map<string, RawJob>()
    let card: string[] = []
    let n = 0
    for (const p of pieces.slice(start + 1, end)) {
      if (!AGE.test(p) || card.length < 3) {
        card.push(p)
        continue
      }
      const [title, company, location, ...rest] = card
      const externalId = ids[n++]
      card = []
      if (!externalId) continue // karta bez odkazu – nelze určit stabilní ID
      jobs.set(externalId, {
        id: `indeed:${externalId}`,
        source: 'indeed',
        externalId,
        title: title!,
        company,
        location,
        salaryText: rest.find((r) => SALARY.test(r)),
        url: `https://cz.indeed.com/viewjob?jk=${externalId}`,
        publishedAt: mail.date,
      })
    }
    return [...jobs.values()]
  },
}
