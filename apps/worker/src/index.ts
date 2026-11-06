import cron from 'node-cron'
import type { Job } from '@job-hunter/shared'
import { sources } from './sources/index.js'
import { criteria } from './criteria.js'
import { passesHardFilter } from './filter.js'
import { notify } from './notify/ntfy.js'
import { checkInbox } from './mail/gmail.js'

// Dočasné úložiště v paměti – nahradí ho databáze (SQLite/PostgreSQL).
const seen = new Map<string, Job>()

async function searchJobs() {
  console.log(`[search] ${new Date().toISOString()} – hledám nabídky…`)
  let newMatches = 0

  for (const source of sources) {
    const found = await source.fetchJobs(criteria)
    for (const raw of found) {
      if (seen.has(raw.id)) continue

      const matched = passesHardFilter(raw, criteria)
      const job: Job = { ...raw, foundAt: new Date().toISOString(), status: matched ? 'matched' : 'rejected' }
      seen.set(job.id, job)

      if (matched) {
        newMatches++
        await notify(`Nová nabídka: ${job.title}`, job.company ?? job.source, job.url)
      }
    }
  }

  console.log(`[search] hotovo, nových vhodných nabídek: ${newMatches}`)
}

const once = process.argv.includes('--once')

if (once) {
  await searchJobs()
  await checkInbox()
} else {
  const searchCron = process.env.SEARCH_CRON ?? '0 */2 * * *'
  const mailCron = process.env.MAIL_CRON ?? '*/10 * * * *'
  cron.schedule(searchCron, searchJobs)
  cron.schedule(mailCron, checkInbox)
  console.log(`[worker] běží – hledání: "${searchCron}", pošta: "${mailCron}"`)
  await searchJobs()
}
