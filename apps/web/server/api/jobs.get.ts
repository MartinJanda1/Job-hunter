import { JOB_LIST_VIEWS, type JobListView } from '@job-hunter/shared'
import { listJobs } from '@job-hunter/core'

// GET /api/jobs?view=inbox|starred|applied|hidden – nabídky se zvýrazněnými klíčovými slovy + počty záložek
export default defineEventHandler((event) => {
  const view = getQuery(event).view ?? 'inbox'
  if (!JOB_LIST_VIEWS.includes(view as JobListView)) {
    throw createError({ statusCode: 400, statusMessage: `Neznámé zobrazení: ${view}` })
  }
  return listJobs(useDb(), view as JobListView)
})
