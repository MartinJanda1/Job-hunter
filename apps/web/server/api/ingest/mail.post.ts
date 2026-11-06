import { ingestMails, validateMails } from '@job-hunter/core'

// POST /api/ingest/mail – e-maily z hlídačů portálů, posílá je Google Apps Script z Gmailu (apps-script/Code.gs).
// Vlastní tajemství INGEST_SECRET (je uložené i v Apps Scriptu, proto ne CRON_SECRET).
export default defineEventHandler(async (event) => {
  requireBearer(event, 'INGEST_SECRET')
  const mails = validateMails(await readBody(event))
  if (typeof mails === 'string') throw createError({ statusCode: 400, statusMessage: mails })
  return ingestMails(useDb(), mails)
})
