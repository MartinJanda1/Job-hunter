import { runSearch } from '@job-hunter/core'

// POST /api/cron/search – jeden běh hledání nabídek. Volá ho plánovač (GitHub Actions) nebo `npm run cron:search`.
export default defineEventHandler(async (event) => {
  requireCronSecret(event)
  return runSearch(useDb())
})
