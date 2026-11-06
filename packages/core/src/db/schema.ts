import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { JobStatus, SourceState } from '@job-hunter/shared'

/** Stav zdroje mezi běhy (např. ETag datové sady MPSV) */
export const sourceState = pgTable('source_state', {
  source: text('source').primaryKey(),
  state: jsonb('state').$type<SourceState>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Nalezené nabídky. Ukládají se i vyřazené (`rejected`), aby se při dalším hledání nehodnotily znovu. */
export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(), // `${source}:${externalId}`
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    company: text('company'),
    location: text('location'),
    remote: boolean('remote'),
    salaryText: text('salary_text'),
    url: text('url').notNull(),
    description: text('description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    foundAt: timestamp('found_at', { withTimezone: true }).notNull().defaultNow(),
    score: integer('score'),
    scoreReason: text('score_reason'),
    status: text('status').$type<JobStatus>().notNull().default('new'),
  },
  (t) => [index('jobs_status_found_at_idx').on(t.status, t.foundAt)],
)

export type JobRow = typeof jobs.$inferSelect
export type NewJobRow = typeof jobs.$inferInsert
