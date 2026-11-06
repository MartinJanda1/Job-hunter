// Ruční spuštění cron endpointu: npm run cron:search [-- https://job-hunter-xyz.vercel.app]
// Výchozí URL je lokální dev server. CRON_SECRET se bere z .env.local (vercel env pull).
const [job, baseUrl = 'http://localhost:3000'] = process.argv.slice(2)

const secret = process.env.CRON_SECRET
if (!secret) {
  console.error('Chybí CRON_SECRET – spusťte `vercel env pull .env.local`')
  process.exit(1)
}

const res = await fetch(`${baseUrl}/api/cron/${job}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
})
console.log(res.status, await res.text())
if (!res.ok) process.exit(1)
