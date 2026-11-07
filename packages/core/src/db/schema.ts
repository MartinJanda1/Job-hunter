import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import type { JobMark, JobStatus, SourceState } from '@job-hunter/shared'

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
    // Ruční označení uživatelem – nezávislé na status (ten řídí filtr a refilter ho přepisuje)
    mark: text('mark').$type<JobMark>(),
    markedAt: timestamp('marked_at', { withTimezone: true }),
  },
  (t) => [index('jobs_status_found_at_idx').on(t.status, t.foundAt), index('jobs_mark_idx').on(t.mark)],
)

/**
 * E-maily od portálů (hlídači nabídek), které posílá Google Apps Script z Gmailu.
 * Ukládají se surové; parser podle odesílatele z nich vytáhne nabídky (`parsedAt` = zpracováno).
 * Díky uloženému HTML jde parser opravit a e-maily zpracovat znovu.
 */
export const mailMessages = pgTable(
  'mail_messages',
  {
    id: text('id').primaryKey(), // Gmail message ID
    fromAddr: text('from_addr').notNull(),
    subject: text('subject').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    html: text('html').notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    parsedAt: timestamp('parsed_at', { withTimezone: true }),
    parser: text('parser'),
    jobsFound: integer('jobs_found'),
  },
  (t) => [index('mail_messages_parsed_at_idx').on(t.parsedAt)],
)

/**
 * Klíčová slova filtru – spravují se z webu (panel Klíčová slova). Zapnutá slova tvoří
 * SearchCriteria.keywords; prázdná tabulka se při prvním načtení naplní DEFAULT_KEYWORDS.
 */
export const keywords = pgTable('keywords', {
  term: text('term').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type JobRow = typeof jobs.$inferSelect
export type NewJobRow = typeof jobs.$inferInsert
