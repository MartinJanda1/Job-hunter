// Nanečisto: spustí parsery na e-mailech uložených v mail_messages a vypíše, co by z nich vzniklo.
// Do DB nic nezapisuje. Použití: npm run mail:dryrun [-- <část adresy odesílatele>]
import { asc } from 'drizzle-orm'
import { createDb, schema } from '../packages/core/src/index'
import { mailParsers } from '../packages/core/src/mail/parsers'

const fromFilter = process.argv[2]?.toLowerCase()
const db = createDb()
const rows = await db.select().from(schema.mailMessages).orderBy(asc(schema.mailMessages.receivedAt))

let total = 0
for (const row of rows) {
  if (fromFilter && !row.fromAddr.toLowerCase().includes(fromFilter)) continue
  const mail = { id: row.id, from: row.fromAddr, subject: row.subject, date: row.receivedAt.toISOString(), html: row.html }
  const parser = mailParsers.find((p) => p.matches(mail))
  const jobs = parser?.parse(mail) ?? []
  total += jobs.length
  console.log(`\n== ${parser?.source ?? 'BEZ PARSERU'} | ${row.subject.slice(0, 80)} → ${jobs.length} nabídek`)
  for (const j of jobs) {
    console.log(`   • ${j.title} | ${j.company ?? '–'} | ${j.location ?? '–'}${j.salaryText ? ` | ${j.salaryText}` : ''} | ${j.id}`)
  }
}
console.log(`\nCelkem nabídek: ${total}`)
