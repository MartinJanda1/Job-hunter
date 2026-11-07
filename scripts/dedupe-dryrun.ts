// Nanečisto: jaké skupiny duplicit by vznikly z uložených nabídek. Do DB nic nezapisuje.
// Použití: npm run dedupe:dryrun [-- <počet vypsaných skupin, výchozí 30>]
import { createDb, schema } from '../packages/core/src/index'
import { dedupeKey } from '../packages/core/src/dedupe'

const show = Number(process.argv[2] ?? 30)
const db = createDb()
const rows = await db
  .select({ id: schema.jobs.id, title: schema.jobs.title, company: schema.jobs.company, source: schema.jobs.source, location: schema.jobs.location, status: schema.jobs.status })
  .from(schema.jobs)

const groups = new Map<string, typeof rows>()
for (const r of rows) {
  const key = dedupeKey(r)
  groups.set(key, [...(groups.get(key) ?? []), r])
}
const dup = [...groups.entries()].filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length)

const pairs: Record<string, number> = {}
for (const [, g] of dup) {
  const key = [...new Set(g.map((r) => r.source))].sort().join(' + ')
  pairs[key] = (pairs[key] ?? 0) + 1
}

console.log(`Nabídek: ${rows.length} | skupin: ${groups.size} | skupin s duplicitami: ${dup.length} | ušetřených karet: ${rows.length - groups.size}`)
console.log('Bez firmy (neslučuje se):', rows.filter((r) => dedupeKey(r).startsWith('id:')).length)
console.log('\nKombinace zdrojů ve skupinách:', pairs)
console.log(`\nSkupiny (prvních ${show}):`)
for (const [key, g] of dup.slice(0, show)) {
  console.log(`\n  ${key}`)
  for (const r of g) console.log(`     [${r.source}] ${r.title} | ${r.company} | ${r.location ?? '–'} | ${r.status}`)
}
