// Lokální vývoj: proměnné z kořene repa. `.env.local` (z `vercel env pull`) má přednost před `.env`,
// protože loadEnvFile nepřepisuje už nastavené proměnné. Na Vercelu soubory nejsou a proměnné dodá platforma.
for (const file of ['../../.env.local', '../../.env']) {
  try {
    process.loadEnvFile(file)
  } catch {}
}

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 }, // používá složku app/
  devtools: { enabled: true },
  app: {
    head: { title: 'Job-hunter', htmlAttrs: { lang: 'cs' } },
  },
  nitro: {
    // Funkce ve Frankfurtu vedle databáze Neon (fra1); výchozí iad1 by každý dotaz posílal přes oceán.
    vercel: { functions: { regions: ['fra1'] } },
  },
})
