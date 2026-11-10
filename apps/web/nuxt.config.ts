import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Lokální vývoj: proměnné z kořene repa. `.env.local` (z `vercel env pull`) má přednost před `.env`,
// protože loadEnvFile nepřepisuje už nastavené proměnné. Na Vercelu soubory nejsou a proměnné dodá platforma.
for (const file of ['../../.env.local', '../../.env']) {
  try {
    process.loadEnvFile(file)
  } catch {}
}

// Verze v hlavičce: číslo z kořenového package.json + commit, ze kterého je build (na Vercelu
// VERCEL_GIT_COMMIT_SHA, lokálně git). Podle commitu je vidět, jestli běží poslední deploy.
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }
function buildCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  runtimeConfig: {
    public: {
      appVersion: version,
      commit: buildCommit(),
      // Formátováno už při buildu – stejný text na serveru i v prohlížeči (bez hydration mismatch)
      builtAt: new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }),
    },
  },
  future: { compatibilityVersion: 4 }, // používá složku app/
  devtools: { enabled: true },
  app: {
    head: { title: 'Job-hunter', htmlAttrs: { lang: 'cs' } },
  },
  nitro: {
    // Funkce ve Frankfurtu vedle databáze Neon (fra1); výchozí iad1 by každý dotaz posílal přes oceán.
    // maxDuration 300 s (strop Hobby plánu) – zpracování datové sady MPSV (~190 MB streamem) trvá desítky sekund.
    vercel: { functions: { regions: ['fra1'], maxDuration: 300 } },
  },
})
