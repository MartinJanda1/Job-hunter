// Nanečisto: jak by kritéria rozdělila uložené nabídky. Do DB nic nezapisuje.
// Bez argumentů = aktuální kritéria z DB (zapnutá klíčová slova). S argumenty = vyzkoušet jiný seznam slov:
//   npm run filter:dryrun                       # aktuální stav
//   npm run filter:dryrun -- vue react nuxt     # jak by vypadal filtr jen s těmito slovy
import { createDb, schema, loadCriteria } from '../packages/core/src/index'
import { passesHardFilter } from '../packages/core/src/filter'

const db = createDb()
const criteria = await loadCriteria(db)
const custom = process.argv.slice(2)
if (custom.length) criteria.keywords = custom

const rows = await db
  .select({ title: schema.jobs.title, description: schema.jobs.description, location: schema.jobs.location, remote: schema.jobs.remote, source: schema.jobs.source, status: schema.jobs.status, company: schema.jobs.company })
  .from(schema.jobs)

const bySource: Record<string, { total: number; matched: number; before: number }> = {}
const matched: typeof rows = []
for (const r of rows) {
  const ok = passesHardFilter({ source: r.source, title: r.title, description: r.description ?? undefined, location: r.location ?? undefined, remote: r.remote ?? undefined }, criteria)
  const s = (bySource[r.source] ??= { total: 0, matched: 0, before: 0 })
  s.total++
  if (r.status === 'matched') s.before++
  if (ok) {
    s.matched++
    matched.push(r)
  }
}

console.log('Kritéria:', JSON.stringify(criteria))
console.log('\nzdroj            celkem   teď vhodné   s kritérii')
for (const [src, s] of Object.entries(bySource)) {
  console.log(`${src.padEnd(16)} ${String(s.total).padStart(6)} ${String(s.before).padStart(12)} ${String(s.matched).padStart(12)}`)
}
console.log(`\nCelkem vhodných s kritérii: ${matched.length} z ${rows.length}\n`)
for (const r of matched.slice(0, 40)) console.log(` • [${r.source}] ${r.title} | ${r.company ?? '–'} | ${r.location ?? '–'}`)
