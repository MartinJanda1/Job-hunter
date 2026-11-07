import { asc, eq, isNull } from 'drizzle-orm'
import type { RawJob } from '@job-hunter/shared'
import type { Db } from '../db/client'
import { mailMessages } from '../db/schema'
import { loadCriteria } from '../criteria'
import { notifyNewMatches, saveJobs } from '../jobs'
import { mailParsers } from './parsers'

/** E-mail tak, jak ho posílá Apps Script (apps-script/Code.gs) */
export interface IncomingMail {
  id: string
  from: string
  subject: string
  date: string // ISO
  html: string
}

export interface IngestResult {
  received: number // kolik e-mailů přišlo v požadavku
  stored: number   // kolik z nich bylo nových
  parsed: number   // kolik nezpracovaných e-mailů se teď zpracovalo (měly parser)
  pending: number  // kolik jich dál čeká na parser
  jobsInserted: number
  matched: number
}

/** Kolik nezpracovaných e-mailů se projde v jednom volání (časový limit funkce) */
const PARSE_BATCH = 200

/** Ověří tvar těla požadavku; vrací chybovou zprávu, nebo pole e-mailů. */
export function validateMails(body: unknown): IncomingMail[] | string {
  const messages = (body as { messages?: unknown })?.messages
  if (!Array.isArray(messages)) return 'Očekávám { messages: [...] }'
  if (messages.length > 500) return 'Příliš mnoho e-mailů v jednom požadavku (max 500)'
  for (const m of messages) {
    const ok =
      m && typeof m.id === 'string' && m.id &&
      typeof m.from === 'string' && typeof m.subject === 'string' &&
      typeof m.html === 'string' && typeof m.date === 'string' && !Number.isNaN(Date.parse(m.date))
    if (!ok) return 'Každý e-mail musí mít id, from, subject, date (ISO) a html'
  }
  return messages as IncomingMail[]
}

/**
 * Uloží nové e-maily a zpracuje všechny dosud nezpracované, pro které existuje parser.
 * Idempotentní: stejný e-mail (Gmail message ID) se uloží jen jednou.
 */
export async function ingestMails(db: Db, mails: IncomingMail[]): Promise<IngestResult> {
  const result: IngestResult = { received: mails.length, stored: 0, parsed: 0, pending: 0, jobsInserted: 0, matched: 0 }

  if (mails.length) {
    const stored = await db
      .insert(mailMessages)
      .values(mails.map((m) => ({ id: m.id, fromAddr: m.from, subject: m.subject, receivedAt: new Date(m.date), html: m.html })))
      .onConflictDoNothing({ target: mailMessages.id })
      .returning({ id: mailMessages.id })
    result.stored = stored.length
  }

  const pending = await db
    .select()
    .from(mailMessages)
    .where(isNull(mailMessages.parsedAt))
    .orderBy(asc(mailMessages.receivedAt))
    .limit(PARSE_BATCH)

  const found: RawJob[] = []
  for (const row of pending) {
    const mail: IncomingMail = { id: row.id, from: row.fromAddr, subject: row.subject, date: row.receivedAt.toISOString(), html: row.html }
    const parser = mailParsers.find((p) => p.matches(mail))
    if (!parser) {
      result.pending++
      continue
    }
    try {
      const jobs = parser.parse(mail)
      found.push(...jobs)
      await db
        .update(mailMessages)
        .set({ parsedAt: new Date(), parser: parser.source, jobsFound: jobs.length })
        .where(eq(mailMessages.id, row.id))
      result.parsed++
    } catch (err) {
      console.error(`[mail] parser ${parser.source} selhal na e-mailu ${row.id}:`, err)
      result.pending++
    }
  }

  const saved = await saveJobs(db, found, await loadCriteria(db))
  result.jobsInserted = saved.inserted
  result.matched = saved.newMatches.length
  await notifyNewMatches(saved.newMatches)

  console.log('[mail] hotovo:', result)
  return result
}
