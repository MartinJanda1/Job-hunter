// Nanečisto: jak by aktuální kritéria (packages/core/src/criteria.ts) rozdělila uložené nabídky.
// Do DB nic nezapisuje. Použití: npm run filter:dryrun [-- <počet ukázek, výchozí 40>]
import { createDb, schema } from '../packages/core/src/index'
import { criteria } from '../packages/core/src/criteria'
import { passesHardFilter } from '../packages/core/src/filter'

const samples = Number(process.argv[2] ?? 40)
const db = createDb()
const rows = await db
  .select({ title: schema.jobs.title, description: schema.jobs.description, location: schema.jobs.location, source: schema.jobs.source, status: schema.jobs.status, company: schema.jobs.company })
  .from(schema.jobs)

const bySource: Record<string, { total: number; matched: number; before: number }> = {}
const matched: typeof rows = []
for (const r of rows) {
  const ok = passesHardFilter({ title: r.title, description: r.description ?? undefined, location: r.location ?? undefined }, criteria)
  const s = (bySource[r.source] ??= { total: 0, matched: 0, before: 0 })
  s.total++
  if (r.status === 'matched') s.before++
  if (ok) {
    s.matched++
    matched.push(r)
  }
}

console.log('Kritéria:', JSON.stringify(criteria))
console.log('\nzdroj            celkem   dřív vhodné   nově vhodné')
for (const [src, s] of Object.entries(bySource)) {
  console.log(`${src.padEnd(16)} ${String(s.total).padStart(6)} ${String(s.before).padStart(13)} ${String(s.matched).padStart(13)}`)
}
console.log(`\nCelkem nově vhodných: ${matched.length} z ${rows.length}\n`)
for (const r of matched.slice(0, samples)) console.log(` • [${r.source}] ${r.title} | ${r.company ?? '–'} | ${r.location ?? '–'}`)
