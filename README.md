# Job-hunter

Vyhledávač pracovních příležitostí: hledá nabídky podle kritérií, filtruje je a hodnotí shodu s mým CV, připravuje odpovědi, zpracovává došlou poštu a posílá notifikace do telefonu.

## Struktura

```
apps/
  web/        Nuxt 3 (Vue 3) – přehled nabídek + API (server/api), včetně cron endpointů
packages/
  shared/     sdílené TypeScript typy (Job, SearchCriteria, …)
  core/       logika hledání, filtrování, pošty a notifikací + DB (Drizzle), volaná z cron endpointů
scripts/
  cron.mjs    ruční spuštění cron endpointu (npm run cron:search)
```

## Nasazení (Vercel)

Celá aplikace běží na Vercelu (Hobby plán, tým `janda3`):

- **Web + API** – Nuxt jako serverless funkce.
- **Databáze** – Neon Postgres připojený přes Vercel Marketplace (`DATABASE_URL` nastaví Vercel).
- **Práce na pozadí** – žádný trvale běžící proces. Hledání a kontrola pošty jsou API endpointy
  (`/api/cron/search`, `/api/cron/mail`) chráněné tokenem `CRON_SECRET`. Volá je externí plánovač
  (GitHub Actions `schedule`), protože Vercel Cron na Hobby plánu běží nejvýš 1× denně.
- Jeden běh funkce má časový limit → nabídky (hlavně hodnocení přes Claude API) zpracovávat po dávkách.

## Technologie

| Část | Volba | Proč |
|---|---|---|
| Frontend + API | Nuxt 3 (Vue 3, TypeScript) | Vue už znám, API routy jsou ve stejném projektu |
| Práce na pozadí | cron endpointy v Nuxtu + GitHub Actions | Vercel nemá trvale běžící procesy |
| Databáze | Neon Postgres + Drizzle ORM | SQLite na Vercelu nejde (dočasný souborový systém) |
| Hodnocení shody | Claude API | porovnání nabídky s CV |
| Pošta | Gmail API (OAuth2) | koncepty odpovědí, třídění příchozích |
| Notifikace | ntfy.sh | jeden HTTP požadavek, appka pro Android/iOS |

## Spuštění

```bash
npm install
vercel env pull .env.local   # DATABASE_URL, CRON_SECRET, … z Vercelu
cp .env.example .env         # a doplnit ostatní hodnoty (ntfy, Claude, Gmail)
npm run db:migrate           # aplikuje migrace na databázi
npm run dev                  # http://localhost:3000
npm run cron:search          # v druhém terminálu: jeden běh hledání
```

## Plán (roadmap)

- [x] Kostra monorepa, sdílené typy, worker s cronem, ntfy notifikace
- [x] Rozhodnutí o nasazení: vše na Vercelu (web, cron endpointy, Neon Postgres)
- [x] Databáze (Drizzle + Neon Postgres) a ukládání nabídek
- [x] Přesun logiky workeru do `packages/core` a endpoint `/api/cron/search`
- [x] GitHub Actions plánovač volající cron endpointy (`.github/workflows/cron.yml`, každé 2 h)
- [x] Průzkum zdrojů nabídek – viz [docs/zdroje.md](docs/zdroje.md)
- [x] Úřad práce ČR (otevřená data MPSV) – IT nabídky z celé ČR
- [x] Příjem e-mailů z hlídačů portálů: Google Apps Script → `/api/ingest/mail` (návod: [docs/gmail-hlidace.md](docs/gmail-hlidace.md))
- [x] Parsery e-mailů: Jobs.cz, LinkedIn
- [ ] Parsery dalších portálů (Prace.cz, StartupJobs, Indeed, annonce.cz…) – až od nich přijdou e-maily
- [x] Remote portály s API (Remotive, Remote OK)
- [x] Jooble API (agregátor – CZ klíč, 1× denně)
- [x] Klíčová slova z CV (zásadní, postupně doplňovat) a lokalita Praha; automatický přepočet po změně kritérií
- [x] Web za přihlášením (heslo `APP_PASSWORD` ve Vercel env / `.env.local`)
- [ ] Hodnocení shody s CV přes Claude API
- [x] Klíčová slova ve webovém UI (zapnout/vypnout, přidat, smazat, statistika) a přehled zdrojů
- [ ] Lokalita a vylučující slova ve webovém UI
- [ ] Gmail: koncepty odpovědí se schválením jedním klikem
- [ ] Gmail: třídění příchozí pošty (pohovor / odmítnutí / dotaz)
- [x] Vercel projekt `janda3/job-hunter` propojený s GitHubem (push na `main` = deploy)

## Zásady

- Odpovědi na nabídky se **neodesílají automaticky** – aplikace připraví koncept, já ho schválím.
- Zdroje nabídek přednostně přes RSS/API; scraping jen tam, kde to podmínky webu dovolují.
- Žádné tajné klíče v repu – vše v `.env` (je v `.gitignore`).
