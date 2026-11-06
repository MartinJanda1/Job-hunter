# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Job-hunter: osobní vyhledávač pracovních nabídek. Hledá nabídky podle kritérií, filtruje je, hodnotí shodu s CV (Claude API), připravuje koncepty odpovědí, třídí příchozí poštu (Gmail) a posílá notifikace do telefonu (ntfy.sh). Komentáře v kódu, logy, UI i README jsou česky – drž se toho.

## Příkazy

npm workspaces monorepo, Node >= 22, ESM (`"type": "module"`) všude.

```bash
npm install
vercel env pull .env.local    # DATABASE_URL, CRON_SECRET, … z Vercelu (projekt janda3/job-hunter)
npm run dev                   # Nuxt dev server, http://localhost:3000
npm run cron:search           # zavolá POST /api/cron/search na localhost (s CRON_SECRET z .env.local)
npm run cron:search -- https://<deployment>.vercel.app   # totéž proti nasazené verzi
npm run typecheck             # tsc (packages/core) + nuxt typecheck (apps/web)
npm run build                 # nuxt build; s NITRO_PRESET=vercel vznikne apps/web/.vercel/output jako na Vercelu
npm run db:generate           # po změně packages/core/src/db/schema.ts → nová SQL migrace v packages/core/drizzle/
npm run db:migrate            # aplikuje migrace na Neon (přes DATABASE_URL_UNPOOLED)
npm run db:studio             # Drizzle Studio nad DB
```

Testy ani linter zatím nejsou nastavené. Migrace se generují a commitují; schéma DB neměnit ručně.

## Architektura

Vše běží na **Vercelu (Hobby plán)**: Nuxt app = serverless funkce (region `fra1`, vedle DB), DB = **Neon Postgres** (Vercel Marketplace, resource `job-hunter-db`). Root directory projektu na Vercelu je `apps/web`; push na `main` = produkční deploy.

- **`packages/shared`** – TypeScript typy (`Job`, `RawJob`, `JobSource`, `SearchCriteria`, …) a konstanty bez závislostí (`SOURCE_LABELS`), použitelné i v prohlížeči. Změny datového modelu začínají tady (a v `db/schema.ts`). UI nesmí importovat `@job-hunter/core` (stáhlo by DB klienta a Node streamy do klienta).
- **`packages/core`** – veškerá doménová logika, bez závislosti na Nuxtu: zdroje nabídek (`sources/`), filtr (`filter.ts`), notifikace (`notify/ntfy.ts`), Gmail (`mail/gmail.ts`, zatím stub), DB (`db/schema.ts`, `db/client.ts`) a `runSearch(db)` v `search.ts`.
  - Pipeline hledání: každý `JobSource` → `fetchJobs(criteria, prevState)` → `passesHardFilter` (klíčová slova, bez AI) → stav `matched`/`rejected` → `INSERT … ON CONFLICT DO NOTHING RETURNING` po dávkách 500 → notifikace jen pro skutečně nově vložené `matched` (víc než 3 = jedna souhrnná). Selhání jednoho zdroje neshodí ostatní (`errors` ve výsledku).
  - Ukládají se i `rejected` nabídky, aby se při dalším běhu znovu nehodnotily. Deduplikace = primární klíč `id` ve tvaru `${source}:${externalId}`.
  - Nový zdroj = adaptér implementující `JobSource` (vrací `{ jobs, state? }`), přidaný do pole v `sources/index.ts`. `state` (např. ETag) se uloží do tabulky `source_state` až po úspěšném uložení nabídek a příště přijde jako `prevState`. Prověřené a zakázané zdroje jsou v [docs/zdroje.md](docs/zdroje.md) – nový zdroj jen s oficiálním přístupem.
  - Podmínky API zdrojů jsou závazné (viz docs/zdroje.md): Remotive a Remote OK vyžadují odkaz na jejich URL nabídky a uvedení zdroje (UI ukazuje `zdroj: …` z `SOURCE_LABELS`) a málo dotazů za den – `isThrottled(prevState, hodiny)` + `fetchedNow()` v `sources/util.ts`.
  - `sources/mpsv.ts` (Úřad práce, ~190 MB JSON): čte se streamem (`stream-json`), nikdy celé do paměti; podmíněný požadavek přes ETag (304 = nic nového); filtr IT podle CZ-ISCO 25xx/35xx. Plný běh ~11 s, bez změny ~1 s.
  - `filter.ts` má druhý krok `scoreAgainstCv` (TODO): CV z `CV_URL` + popis nabídky → Claude vrátí JSON `{ score: 0–100, reason }`.
  - Kritéria jsou zatím natvrdo v `criteria.ts` (plán: v DB, editovatelná z UI).
  - DB klient je `drizzle-orm/neon-http` (každý dotaz = HTTP požadavek, žádné držené spojení) → bez interaktivních transakcí; víc zápisů najednou řešit jedním příkazem nebo `db.batch`.
  - Balíček se nebuildí (`main` = `src/index.ts`), bundluje ho Nitro. Relativní importy **bez přípony** (`./filter`, ne `./filter.js`).
- **`apps/web`** – Nuxt 3 s `compatibilityVersion: 4` (frontend v `app/`, API v `server/`).
  - `server/api/cron/*.post.ts` – vstupní body pro práci na pozadí; každý začíná `requireCronSecret(event)` (`Authorization: Bearer $CRON_SECRET`) a jen volá funkci z `@job-hunter/core`.
  - `server/utils/` – `useDb()` a `requireCronSecret()` (Nitro auto-import).
  - `GET /api/jobs?status=…|all` – posledních 100 nabídek z DB (výchozí `matched`).
  - `nuxt.config.ts` načítá `../../.env.local` a `../../.env` z kořene repa (Nuxt by jinak četl jen `apps/web/.env`).
  - `nitro-types.d.ts` doplňuje typy nitra pro `nuxt.config` (bez něj `nuxt typecheck` nezná `nitro.vercel`).

Roadmapa je v README.md.

## Omezení Vercelu, která musí nový kód respektovat

- **Žádný trvale běžící proces** (žádný `node-cron`, `setInterval`, worker). Práce na pozadí = cron endpoint volaný zvenku.
- **Spouštění:** `.github/workflows/cron.yml` (GitHub Actions `schedule`, UTC, + ruční `workflow_dispatch`) volá cron endpointy s repo secretem `CRON_SECRET` a variable `APP_URL`. Nový cron endpoint = nový job v tomto workflow. Při změně `CRON_SECRET` ho aktualizovat ve Vercel env i v GitHub secrets. Vercel Cron na Hobby běží nejvýš 1× denně – nepoužívat pro hledání ani poštu.
- **Žádný lokální souborový stav** (SQLite, soubory, paměť mezi požadavky) – všechno do Postgresu.
- **Časový limit funkce:** endpointy musí být idempotentní a zpracovávat po dávkách (hlavně hodnocení přes Claude API).
- Proměnné prostředí se přidávají přes `vercel env add` pro production/preview/development a lokálně stahují `vercel env pull .env.local`. Hodnoty posílat do `vercel env add` přes bash (`printf %s`), ne přes rouru v PowerShellu – ten přidá BOM.

## Zásady

- Odpovědi na nabídky se **nikdy neodesílají automaticky** – aplikace jen vytvoří koncept (Gmail draft), uživatel ho schválí.
- Zdroje nabídek přednostně přes RSS/API; scraping jen tam, kde to podmínky webu dovolují.
- Tajné hodnoty jen v `.env` / `.env.local` / Vercel env; Gmail OAuth soubory (`credentials.json`, `token.json`) jsou v `.gitignore`. Repo je veřejné.
