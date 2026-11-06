# Job-hunter

Vyhledávač pracovních příležitostí: hledá nabídky podle kritérií, filtruje je a hodnotí shodu s mým CV, připravuje odpovědi, zpracovává došlou poštu a posílá notifikace do telefonu.

## Struktura

```
apps/
  web/        Nuxt 3 (Vue 3) – přehled nabídek + API (server/api)
  worker/     Node.js proces na pozadí – hledání, filtrování, pošta, notifikace
packages/
  shared/     sdílené TypeScript typy (Job, SearchCriteria, …)
```

## Technologie

| Část | Volba | Proč |
|---|---|---|
| Frontend + API | Nuxt 3 (Vue 3, TypeScript) | Vue už znám, API routy jsou ve stejném projektu |
| Práce na pozadí | Node.js + node-cron | pravidelné hledání a kontrola pošty |
| Databáze | SQLite → později PostgreSQL | jednoduchý start |
| Hodnocení shody | Claude API | porovnání nabídky s CV |
| Pošta | Gmail API (OAuth2) | koncepty odpovědí, třídění příchozích |
| Notifikace | ntfy.sh | jeden HTTP požadavek, appka pro Android/iOS |

## Spuštění

```bash
npm install
cp .env.example .env     # a doplnit hodnoty
npm run dev:web          # http://localhost:3000
npm run dev:worker       # v druhém terminálu
```

## Plán (roadmap)

- [x] Kostra monorepa, sdílené typy, worker s cronem, ntfy notifikace
- [ ] Databáze (Drizzle + SQLite) a ukládání nabídek z workeru
- [ ] První reálné zdroje nabídek (RSS / API portálů)
- [ ] Hodnocení shody s CV přes Claude API
- [ ] Nastavení kritérií ve webovém UI
- [ ] Gmail: koncepty odpovědí se schválením jedním klikem
- [ ] Gmail: třídění příchozí pošty (pohovor / odmítnutí / dotaz)
- [ ] Nasazení: web na Vercel, worker na Railway / Fly.io

## Zásady

- Odpovědi na nabídky se **neodesílají automaticky** – aplikace připraví koncept, já ho schválím.
- Zdroje nabídek přednostně přes RSS/API; scraping jen tam, kde to podmínky webu dovolují.
- Žádné tajné klíče v repu – vše v `.env` (je v `.gitignore`).
