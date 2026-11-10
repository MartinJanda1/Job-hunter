import type { RawJob } from '@job-hunter/shared'
import { decodeEntities, textPieces } from '../html'
import type { MailParser } from '../parsers'

/**
 * Annonce – hlídací pes HafANN („Vystopoval jsem 3 nové inzeráty v tvých oblíbených rubrikách“,
 * hafann@inzerce.annonce.cz). Inzeráty jsou ve sloupcích tabulky: řádek názvů, řádek popisů
 * (začátek textu inzerátu) a řádek tlačítek „zobrazit“ – i-tý sloupec = i-tý inzerát.
 * Firmu ani lokalitu e-mail neuvádí.
 *
 * Odkaz tlačítka je sledovací (mandrillapp.com), ale přímá URL inzerátu
 * https://www.annonce.cz/inzerat/<slug>-<ID>-<kód>.html je v HTML i v `<v:roundrect href>` pro Outlook –
 * bereme ji odtud (bez utm parametrů), sledovací odkaz neotevíráme.
 * Potvrzovací e-mail hlídače obsahuje ukázkové inzeráty („tohle je jen ukázka“) – ty se přeskakují.
 */
const AD_URL = /https:\/\/www\.annonce\.cz\/inzerat\/[^"?#\s]*?-(\d+)-[a-z0-9]+\.html/gi

/** Nejvnitřnější řádky tabulek (bez vnořeného <tr>) */
function innermostRows(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>((?:(?!<\/?tr\b)[\s\S])*)<\/tr>/gi)].map((m) => m[1]!)
}

/** Neprázdné buňky řádku jako text */
function cells(row: string): string[] {
  return row
    .split(/<td\b/i)
    .slice(1)
    .map((c) => textPieces(`<td${c}`).join(' '))
    .filter(Boolean)
}

export const annonceParser: MailParser = {
  source: 'annonce',
  matches: (mail) => /@(?:[\w-]+\.)*annonce\.cz\b/i.test(mail.from),
  parse(mail) {
    if (textPieces(mail.html).some((p) => /jen ukázka/i.test(p))) return []

    // Spacerové řádky (&nbsp;) nemají text → vynechat, aby šly názvy, popisy a tlačítka po sobě
    const rows = innermostRows(mail.html).filter((r) => textPieces(r).length > 0)
    const jobs = new Map<string, RawJob>()

    rows.forEach((row, i) => {
      const urls = [...new Map([...row.matchAll(AD_URL)].map((m) => [m[1]!, decodeEntities(m[0])])).entries()]
      if (!urls.length || i < 2) return

      const titles = cells(rows[i - 2]!)
      const descriptions = cells(rows[i - 1]!)
      if (titles.length !== urls.length) return // nečekaný tvar – raději nic než špatně spárované

      urls.forEach(([externalId, url], col) => {
        jobs.set(externalId, {
          id: `annonce:${externalId}`,
          source: 'annonce',
          externalId,
          title: titles[col]!,
          description: descriptions.length === urls.length ? descriptions[col] : undefined,
          url,
          publishedAt: mail.date,
        })
      })
    })

    return [...jobs.values()]
  },
}
