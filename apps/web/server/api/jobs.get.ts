import { desc, eq } from 'drizzle-orm'
import type { Job, JobStatus } from '@job-hunter/shared'
import { rowToJob, schema } from '@job-hunter/core'

// GET /api/jobs?status=matched|rejected|…|all – posledních 100 nabídek (výchozí: jen vhodné).
export default defineEventHandler(async (event): Promise<Job[]> => {
  const status = (getQuery(event).status as JobStatus | 'all' | undefined) ?? 'matched'
  const { jobs } = schema

  const rows = await useDb()
    .select()
    .from(jobs)
    .where(status === 'all' ? undefined : eq(jobs.status, status))
    .orderBy(desc(jobs.foundAt))
    .limit(100)

  return rows.map(rowToJob)
})
