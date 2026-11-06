# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Job-hunter: osobní vyhledávač pracovních nabídek. Hledá nabídky podle kritérií, filtruje je, hodnotí shodu s CV (Claude API), připravuje koncepty odpovědí, třídí příchozí poštu (Gmail) a posílá notifikace do telefonu (ntfy.sh). Komentáře v kódu, logy, UI i README jsou česky – drž se toho.

## Příkazy

npm workspaces monorepo, Node >= 20, ESM (`"type": "module"`) všude.

```bash
npm install
cp .env.example .env          # doplnit hodnoty
npm run dev:web               # Nuxt dev server, http://localhost:3000
npm run dev:worker            # worker v tsx watch, načítá ../../.env
npm run once -w apps/worker   # jeden běh hledání + kontroly pošty bez cronu (vhodné k testování)
npm run typecheck             # tsc --noEmit (zatím má skript jen worker)
npm run build                 # build všech workspaces, které ho mají (zatím jen web)
```

Testy ani linter zatím nejsou nastavené.

## Architektura

- **`packages/shared`** – jen TypeScript typy (`Job`, `JobStatus`, `SearchCriteria`, `JobSource`, `MailCategory`). Exportuje přímo `src/index.ts` bez buildu; web i worker ho importují jako `@job-hunter/shared`. Změny datového modelu začínají tady.
- **`apps/worker`** – dlouho běžící Node proces (`src/index.ts`). Přes `node-cron` spouští `searchJobs` (`SEARCH_CRON`) a `checkInbox` (`MAIL_CRON`); s `--once` proběhne jednou a skončí.
  - Pipeline hledání: každý `JobSource` z `src/sources/index.ts` → `fetchJobs(criteria)` → deduplikace podle `id` → `passesHardFilter` (klíčová slova, bez AI) → stav `matched`/`rejected` → u `matched` notifikace přes `notify()`.
  - Nový zdroj nabídek = nový adaptér implementující `JobSource`, přidaný do pole `sources`. `id` musí mít tvar `${source}:${externalId}`.
  - `filter.ts` má druhý krok `scoreAgainstCv` (TODO): CV z `CV_URL` + popis nabídky → Claude vrátí JSON `{ score: 0–100, reason }`.
  - `mail/gmail.ts` je zatím stub (plán: `googleapis`, OAuth2, `createDraft`, `checkInbox` s tříděním do `MailCategory`).
  - Kritéria jsou zatím natvrdo v `criteria.ts`, úložiště je zatím `Map` v paměti.
  - Relativní importy v workeru používají příponu `.js` (ESM), i když jsou zdrojáky `.ts`.
- **`apps/web`** – Nuxt 3 s `compatibilityVersion: 4` (frontend ve složce `app/`, API v `server/api/`). `GET /api/jobs` zatím vrací ukázková data; má číst z databáze, do které zapisuje worker.

Roadmapa je v README.md.

## Cílová architektura (rozhodnuto, zatím neimplementováno)

Vše poběží na **Vercelu (Hobby plán)**. Z toho plynou omezení, která nový kód musí respektovat:

- **Žádný trvale běžící proces.** `apps/worker` s `node-cron` je přechodný stav. Logika (zdroje, filtr, notifikace, pošta) se přesune do `packages/core` a bude se volat z Nuxt endpointů `server/api/cron/search.post.ts` a `server/api/cron/mail.post.ts`, chráněných hlavičkou s `CRON_SECRET`.
- **Spouštění:** externí plánovač (GitHub Actions `schedule`) volá cron endpointy. Vercel Cron na Hobby plánu běží nejvýš 1× denně, takže ho nepoužívat pro hledání ani poštu.
- **Databáze: Neon Postgres (Vercel Marketplace) + Drizzle ORM**, ne SQLite. Souborový systém na Vercelu je dočasný. `DATABASE_URL` nastavuje Vercel integrace.
- **Časový limit funkce:** endpointy musí být idempotentní a zpracovávat po dávkách (hlavně hodnocení přes Claude API). Stav (co už je viděné či ohodnocené) patří do DB, ne do paměti.

## Zásady

- Odpovědi na nabídky se **nikdy neodesílají automaticky** – aplikace jen vytvoří koncept (Gmail draft), uživatel ho schválí.
- Zdroje nabídek přednostně přes RSS/API; scraping jen tam, kde to podmínky webu dovolují.
- Tajné hodnoty jen v `.env`; Gmail OAuth soubory (`credentials.json`, `token.json`) jsou v `.gitignore`.
