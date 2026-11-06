import Parser from 'rss-parser'
import type { JobSource, RawJob } from '@job-hunter/shared'

/**
 * Ukázkový zdroj: obecná RSS feed s nabídkami.
 * Do FEEDS přidejte RSS adresy portálů, které je nabízejí
 * (mnoho pracovních portálů umí RSS pro uložené hledání).
 * Pozn.: scraping webů bez API často porušuje podmínky použití – preferujte RSS/API.
 */
const FEEDS: string[] = [
  'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
]

// Timeout, ať jeden pomalý feed nespotřebuje časový limit serverless funkce.
const parser = new Parser({ timeout: 15_000 })

export const rssSource: JobSource = {
  name: 'rss',
  async fetchJobs() {
    const results: RawJob[] = []
    for (const feedUrl of FEEDS) {
      try {
        const feed = await parser.parseURL(feedUrl)
        for (const item of feed.items) {
          if (!item.link) continue
          results.push({
            id: `rss:${item.guid ?? item.link}`,
            source: 'rss',
            externalId: item.guid ?? item.link,
            title: item.title ?? '(bez názvu)',
            url: item.link,
            description: item.contentSnippet,
            publishedAt: item.isoDate,
          })
        }
      } catch (err) {
        console.error(`[rss] Nepodařilo se načíst ${feedUrl}:`, err)
      }
    }
    return { jobs: results }
  },
}
