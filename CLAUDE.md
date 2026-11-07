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
npm run mail:dryrun [-- linkedin]   # parsery nanečisto nad e-maily v mail_messages (do DB nic nezapisuje)
npm run filter:dryrun [-- vue react]  # jak by kritéria (z DB, nebo zadaná slova) rozdělila uložené nabídky (do DB nic nezapisuje)
npm run dedupe:dryrun [-- 30]         # skupiny duplicit podle aktuální normalizace (do DB nic nezapisuje)
```

Testy ani linter zatím nejsou nastavené. Migrace se generují a commitují; schéma DB neměnit ručně.

## Architektura

Vše běží na **Vercelu (Hobby plán)**: Nuxt app = serverless funkce (region `fra1`, vedle DB), DB = **Neon Postgres** (Vercel Marketplace, resource `job-hunter-db`). Root directory projektu na Vercelu je `apps/web`; push na `main` = produkční deploy.

- **`packages/shared`** – TypeScript typy (`Job`, `RawJob`, `JobSource`, `SearchCriteria`, …) a konstanty bez závislostí (`SOURCE_LABELS`), použitelné i v prohlížeči. Změny datového modelu začínají tady (a v `db/schema.ts`). UI nesmí importovat `@job-hunter/core` (stáhlo by DB klienta a Node streamy do klienta).
- **`packages/core`** – veškerá doménová logika, bez závislosti na Nuxtu: zdroje nabídek (`sources/`), filtr (`filter.ts`), uložení + notifikace nabídek (`jobs.ts`: `saveJobs`, `notifyNewMatches` – sdílí je hledání i pošta), notifikace (`notify/ntfy.ts`), pošta (`mail/`), DB (`db/schema.ts`, `db/client.ts`) a `runSearch(db)` v `search.ts`.
  - **Pošta (hlídači portálů):** Google Apps Script v Gmailu uživatele (`apps-script/Code.gs`, návod `docs/gmail-hlidace.md`) každou hodinu pošle e-maily od portálů na `POST /api/ingest/mail` (`INGEST_SECRET`). `ingestMails` je uloží surové do `mail_messages` a zpracuje všechny nezpracované, pro které existuje parser v `mail/parsers.ts` (podle odesílatele). Bez parseru zůstávají `parsed_at = null` a zpracují se, až parser přibude. Parsery psát jen podle skutečných e-mailů v `mail_messages`, ne podle odhadu, a ověřit přes `npm run mail:dryrun`. Žádný Gmail OAuth – Apps Script běží pod účtem uživatele.
    - Parsery: `mail/parsers/jobscz.ts` (karta: pozice | [mzda] | [štítky] | firma | • | lokalita; odkazy jen sledovací track.jobs.cz → ID = otisk pozice+firmy+lokality, sledovací odkazy **neotevírat** – počítaly by se jako klik uživatele), `mail/parsers/linkedin.ts` (ID z `/comm/jobs/view/<ID>/`, víc odkazů na nabídku → seskupit podle ID, URL kanonická bez sledování). Pomocné funkce pro HTML v `mail/html.ts`.
  - Pipeline hledání: každý `JobSource` → `fetchJobs(criteria, prevState)` → `passesHardFilter` (klíčová slova, bez AI) → stav `matched`/`rejected` → `INSERT … ON CONFLICT DO NOTHING RETURNING` po dávkách 500 → notifikace jen pro skutečně nově vložené `matched` (víc než 3 = jedna souhrnná). Selhání jednoho zdroje neshodí ostatní (`errors` ve výsledku).
  - Ukládají se i `rejected` nabídky, aby se při dalším běhu znovu nehodnotily. Deduplikace = primární klíč `id` ve tvaru `${source}:${externalId}`.
  - Nový zdroj = adaptér implementující `JobSource` (vrací `{ jobs, state? }`), přidaný do pole v `sources/index.ts`. `state` (např. ETag) se uloží do tabulky `source_state` až po úspěšném uložení nabídek a příště přijde jako `prevState`. Prověřené a zakázané zdroje jsou v [docs/zdroje.md](docs/zdroje.md) – nový zdroj jen s oficiálním přístupem.
  - Podmínky API zdrojů jsou závazné (viz docs/zdroje.md): Remotive a Remote OK vyžadují odkaz na jejich URL nabídky a uvedení zdroje (UI ukazuje `zdroj: …` z `SOURCE_LABELS`) a málo dotazů za den – `isThrottled(prevState, hodiny)` + `fetchedNow()` v `sources/util.ts`.
  - `sources/jooble.ts`: český klíč `JOOBLE_API_KEY` platí jen na `cz.jooble.org`; dotazy šetřit (limit klíče možná ~500 celkem) – při ladění nevolat API zbytečně, stav `requests` v `source_state` ukazuje spotřebu.
  - `sources/mpsv.ts` (Úřad práce, ~190 MB JSON): čte se streamem (`stream-json`), nikdy celé do paměti; podmíněný požadavek přes ETag (304 = nic nového); filtr IT podle CZ-ISCO 25xx/35xx. Plný běh ~11 s, bez změny ~1 s.
  - `filter.ts` má druhý krok `scoreAgainstCv` (TODO): CV z `CV_URL` + popis nabídky → Claude vrátí JSON `{ score: 0–100, reason }`.
  - **Kritéria:** klíčová slova jsou v tabulce `keywords` (term, enabled) a spravují se z webu (panel Klíčová slova: zapnout/vypnout, přidat, smazat, statistika výskytu); `loadCriteria(db)` vrací zapnutá slova + `LOCATIONS` z `criteria.ts`. Prázdnou tabulku naplní `DEFAULT_KEYWORDS` (zapnutá zásadní slova z CV + vypnuté návrhy). Lokalita je zatím v kódu (jen Praha – remote zdroje tím neprojdou). Každá změna slov přes API hned spustí `refilterIfCriteriaChanged`. Uživatel chce zásadní slova a přidávat je postupně.
  - **Nastavení filtru** v tabulce `settings` (key → jsonb), `getSettings`/`saveSettings` v `criteria.ts`, `PATCH /api/settings`. Zatím `czechOnly` („Jen inzeráty v češtině“): `language.ts` → `detectLanguage` (česká/anglická slova + česká diakritika) je konzervativní – vyřadí jen jasně anglické (`en`), krátký/nejasný text (např. jen název z hlídače) je `unknown` a projde. `filter.ts` porovnává po celých slovech, bez diakritiky a velikosti písmen; lokalita přes aliasy (Prague, Hlavní město Praha…), nabídka bez lokality neprojde.
  - `refilter.ts`: na začátku `runSearch` se porovná otisk kritérií s uloženým (`source_state` klíč `_criteria`); po změně se přepočítá stav všech nabídek `matched`/`rejected` (ostatní stavy nechá) – bez notifikací. Změnu kritérií nejdřív ověřit `npm run filter:dryrun`.
  - DB klient je `drizzle-orm/neon-http` (každý dotaz = HTTP požadavek, žádné držené spojení) → bez interaktivních transakcí; víc zápisů najednou řešit jedním příkazem nebo `db.batch`.
  - Balíček se nebuildí (`main` = `src/index.ts`), bundluje ho Nitro. Relativní importy **bez přípony** (`./filter`, ne `./filter.js`).
- **`apps/web`** – Nuxt 3 s `compatibilityVersion: 4` (frontend v `app/`, API v `server/`).
  - `server/api/cron/*.post.ts` – vstupní body pro práci na pozadí; každý začíná `requireCronSecret(event)` (`Authorization: Bearer $CRON_SECRET`) a jen volá funkci z `@job-hunter/core`.
  - `server/api/ingest/mail.post.ts` – příjem e-mailů z Apps Scriptu, `requireBearer(event, 'INGEST_SECRET')`. Vercel přijme tělo max. 4,5 MB (skript posílá dávky ≤ 3 MB).
  - `server/utils/` – `useDb()`, `requireBearer()` / `requireCronSecret()`, přihlášení `session.ts` (Nitro auto-import).
  - **Přihlášení:** celá aplikace je za heslem (`server/middleware/auth.ts`); výjimky jen `/login`, `/api/auth/*`, `/api/cron/*`, `/api/ingest/*` (vlastní tokeny) a statické soubory. Jedno heslo `APP_PASSWORD`, cookie `jh_session` = expirace + HMAC (`SESSION_SECRET`), 30 dní, bez DB. Změna `SESSION_SECRET` odhlásí všechna zařízení. Nový veřejný endpoint = výslovně ho přidat do `PUBLIC_PREFIXES`. Vercel Deployment Protection na Hobby produkci nechrání, proto vlastní řešení.
  - `GET /api/jobs?view=inbox|starred|applied|hidden` – `JobsResponse` (max. 200 nabídek + počty záložek). Nabídky jsou `JobListItem`: bez celého popisu, s `keywords` (která zapnutá slova obsahují), `titleParts` a `excerpt` jako `TextPart[]` (zvýraznění počítá server v `core/src/highlight.ts` stejnou logikou jako filtr – celá slova, bez diakritiky, s mapou pozic na původní text). UI zvýraznění vykresluje přes `HighlightText.vue` **bez v-html** (text z inzerátů nikdy jako HTML).
  - **Duplicity** (`core/src/dedupe.ts`): `jobs.dedupe_key` = normalizovaný název (bez m/ž, „@ Firma“) + firma (bez s.r.o., a.s., odštěpný závod, Czech Republic…); bez firmy unikátní `id:<id>`. Seznam ukazuje jednu kartu za skupinu (hlavní = nejvíc informací, přímý zdroj před Jooble) s `others` („Také na“); počty záložek počítají skupiny; označení se ukládá a dědí v celé skupině (`propagateMarks`); notifikace jen pro novou skupinu. Klíče doplňuje/přepočítává `syncDedupeKeys` na začátku `runSearch` – **po změně normalizace zvýšit `DEDUPE_VERSION`** a ověřit `npm run dedupe:dryrun`.
  - **Označování:** sloupec `jobs.mark` (`starred` | `applied` | `hidden` | null) + `marked_at`, `PATCH /api/jobs/:id { mark }`. Je nezávislý na `status` (ten řídí filtr a refilter ho přepisuje). Záložka `inbox` = `status = matched` a bez označení.
  - `GET/POST /api/keywords`, `PATCH/DELETE /api/keywords/:term` – správa klíčových slov (vrací `KeywordsResponse` se statistikou); `GET /api/sources` – přehled zdrojů (`SourceView`). Typy odpovědí jsou v `packages/shared`, popis zdrojů v `SOURCES` tamtéž.
  - Frontend: `app/app.vue` (rozvržení), `app/components/JobsList.vue` (záložky, karty, označování s okamžitou lokální úpravou + „Zpět“), `KeywordsPanel.vue`, `SourcesPanel.vue`, `HighlightText.vue`; useFetch klíče `jobs`, `keywords`, `sources` – po změně slov `refreshNuxtData(['jobs', 'sources'])`.
  - `$fetch` s URL z template literálu (`/api/x/${id}`) shodí `nuxt typecheck` („Excessive stack depth“ při odvozování typů Nitro rout) – URL předat jako proměnnou typu `string` a typ odpovědi uvést generikem.
  - VS Code v `.vue` hlásí „Cannot find name 'useFetch'/'ref'“ – jen editor (pravděpodobně TypeScript 7 vs. Vue tooling); rozhoduje `npm run typecheck`.
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
