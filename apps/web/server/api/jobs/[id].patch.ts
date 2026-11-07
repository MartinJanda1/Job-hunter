import { JOB_MARKS, type JobMark } from '@job-hunter/shared'
import { setJobMark } from '@job-hunter/core'

// PATCH /api/jobs/:id { mark: 'starred' | 'applied' | 'hidden' | null } – ruční označení nabídky
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  const { mark } = (await readBody<{ mark?: unknown }>(event)) ?? {}
  if (mark !== null && !JOB_MARKS.includes(mark as JobMark)) {
    throw createError({ statusCode: 400, statusMessage: `Očekávám mark: ${JOB_MARKS.join(' | ')} | null` })
  }
  if (!(await setJobMark(useDb(), id, mark as JobMark | null))) {
    throw createError({ statusCode: 404, statusMessage: 'Nabídka neexistuje' })
  }
  return { id, mark }
})
