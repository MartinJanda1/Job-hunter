export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 }, // používá složku app/
  devtools: { enabled: true },
  app: {
    head: { title: 'Job-hunter', htmlAttrs: { lang: 'cs' } },
  },
})
