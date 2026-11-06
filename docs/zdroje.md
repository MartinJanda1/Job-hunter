# Zdroje nabídek

Průzkum z 2026-11-06 (robots.txt, veřejné feedy/API, dokumentace). Zásada: jen oficiální přístup (RSS, API, otevřená data, vlastní e-maily) – žádný scraping proti podmínkám webu.

## Zapojené

| Zdroj | Adaptér | Přístup | Poznámka |
|---|---|---|---|
| Úřad práce ČR (otevřená data MPSV) | `sources/mpsv.ts` | `https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json` | ~190 MB, denní aktualizace, podmíněné stažení přes ETag. Filtr CZ-ISCO 25xx/35xx (IT): ~926 nabídek, ~480 Praha. Mzda od–do, IČO. Vlastní URL má jen zlomek nabídek; formát odkazu na detail na uradprace.cz zatím neověřen. |
| We Work Remotely | `sources/rss.ts` | RSS kategorií programming, front-end | Jen remote, anglicky. |

## Plánované

| Zdroj | Přístup | Poznámka |
|---|---|---|
| E-mailoví hlídači (Jobs.cz, Prace.cz, StartupJobs, LinkedIn, Indeed, Cocuma…) | Gmail API – parsování e-mailů od portálů | Jediná legální cesta k velkým portálům bez veřejného feedu. Parser pro každou šablonu e-mailu. |
| Remotive, RemoteOK, Jobicy | veřejné API / RSS | Jen remote. Ověřit podmínky (uvedení zdroje, limity frekvence). |
| Jooble | oficiální REST API, klíč na žádost (jooble.org/api/about) | Agregátor s CZ verzí; pokrytí ČR ověřit prvním dotazem. |

## Nepoužívat (bez veřejného přístupu)

| Portál | Důvod |
|---|---|
| Jobs.cz, Prace.cz (Alma Career) | Bez RSS, `robots.txt` zakazuje `/api/` (Prace.cz i `/hledat/`). → hlídače e-mailem |
| StartupJobs.cz | Public API je jen pro firmy (vlastní nabídky, token firmy). Interní `/api/offers` neoficiální. → hlídače, případně dotaz na partnerský feed |
| Profesia.cz | XML feed slouží inzerentům k vkládání nabídek |
| LinkedIn | Podmínky zakazují scraping. → hlídače |
| Indeed | `robots.txt` zakazuje `?rss`, API pro uchazeče není. → hlídače |
| NoFluffJobs, Cocuma, JobStack.it, Welcome to the Jungle | Bez feedu, `robots.txt` blokuje API / vyhledávací dotazy |
