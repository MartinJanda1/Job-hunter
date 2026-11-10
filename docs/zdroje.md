# Zdroje nabídek

Průzkum z 2026-11-06 (robots.txt, veřejné feedy/API, dokumentace). Zásada: jen oficiální přístup (RSS, API, otevřená data, vlastní e-maily) – žádný scraping proti podmínkám webu.

## Zapojené

| Zdroj | Adaptér | Přístup | Poznámka |
|---|---|---|---|
| Úřad práce ČR (otevřená data MPSV) | `sources/mpsv.ts` | `https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json` | ~190 MB, denní aktualizace, podmíněné stažení přes ETag. Filtr CZ-ISCO 25xx/35xx (IT): ~926 nabídek, ~480 Praha. Mzda od–do, IČO. Vlastní URL (`urlAdresa`) má jen zlomek nabídek, ostatní odkazují na detail `https://up.gov.cz/volna-mista-v-cr#/volna-mista-detail/<portalId>` (routa z kódu aplikace ÚP; staré `uradprace.cz/web/cz/vyhledani-volneho-mista` vrací 404). |
| We Work Remotely | `sources/rss.ts` | RSS kategorií programming, front-end | Jen remote, anglicky. |
| Jooble (agregátor) | `sources/jooble.ts` | `POST https://cz.jooble.org/api/{JOOBLE_API_KEY}` | Klíč je vázaný na zemi – **český** klíč (cz.jooble.org/api/about), klíč z jooble.org = jen USA. Agreguje i NoFluffJobs, JobStack, StartupJobs, Cocuma, Teamtailor… Šetříme dotazy (neoficiálně limit ~500 celkem): 1× denně, `ResultOnPage: 100`, klíčová slova čárkou (= nebo), po prvním běhu `datecreatedfrom`; počítadlo `requests` ve stavu zdroje. ID přesahují `Number.MAX_SAFE_INTEGER` → čtou se jako text. Vrací i zahraniční nabídky. |
| Remotive | `sources/remotive.ts` | `https://remotive.com/api/remote-jobs?category=software-dev` | **Podmínky:** odkaz na URL nabídky na Remotive + uvést Remotive jako zdroj; max. 4 dotazy/den (stahujeme 1× za 6 h); nabídky zpožděné o 24 h; nepřeposílat na jiné job weby. |
| Remote OK | `sources/remoteok.ts` | `https://remoteok.com/api` | **Podmínky:** odkaz na URL nabídky na Remote OK (bez nofollow) + uvést „Remote OK“ jako zdroj; nepoužívat logo. 1× za 6 h. API posílá ne-ASCII znaky dvojitě zakódované – opravuje `fixMojibake`. |
| Jobs.cz (hlídač) | `mail/parsers/jobscz.ts` | e-mail z uložených hledání | Jen sledovací odkazy `track.jobs.cz` (neotevírat) → ID = otisk pozice + firmy + lokality. |
| LinkedIn (hlídač) | `mail/parsers/linkedin.ts` | e-mail `jobalerts-noreply@linkedin.com` | ID z `/comm/jobs/view/<ID>/`, kanonická URL bez sledování. |
| StartupJobs (hlídač) | `mail/parsers/startupjobs.ts` | e-mail `jobot@startupjobs.cz` (sledovaná hledání, „Nabídky práce na míru“) | ID z `/nabidka/<ID>/`, URL bez `utm_*`. E-mail obsahuje jen firmu a pozici – **bez lokality a mzdy**; lokalitu hlídá sledované hledání na portálu (`locationPrefiltered`). |
| Prace.cz (hlídač) | `mail/parsers/pracecz.ts` | e-mail z uloženého hledání | Jen sledovací odkazy `r.emailing2.prace.cz` (neotevírat) → ID = otisk pozice + firmy + lokality. Lokalita i mzda v kartě. |
| annonce.cz (hlídací pes HafANN) | `mail/parsers/annonce.ts` | e-mail `hafann@inzerce.annonce.cz` | Tlačítka vedou přes Mandrill (neotevírat), přímá URL `/inzerat/<slug>-<ID>-<kód>.html` je v HTML (`v:roundrect` pro Outlook). Jen název a začátek textu – **bez firmy a lokality**; lokalitu hlídá hlídací pes (`locationPrefiltered`). Potvrzovací e-mail má ukázkové inzeráty → přeskočit. |

## Plánované

| Zdroj | Přístup | Poznámka |
|---|---|---|
| Další e-mailoví hlídači (Indeed, Cocuma, Profesia…) | Google Apps Script v Gmailu → endpoint aplikace | Jediná legální cesta k velkým portálům bez veřejného feedu. Parser pro každou šablonu e-mailu – až od portálu přijdou skutečné e-maily. |
| Jobicy | veřejné API / RSS | Jen remote. Ověřit podmínky. |

## Nepoužívat (bez veřejného přístupu)

| Portál | Důvod |
|---|---|
| Jobs.cz, Prace.cz (Alma Career) | Bez RSS, `robots.txt` zakazuje `/api/` (Prace.cz i `/hledat/`). → hlídače e-mailem |
| Práce za rohem (pracezarohem.cz, Alma Career) | Prověřeno 2026-11-08: bez RSS/API (`/rss`, `/feed`, `/api` = 404). `robots.txt` výpisy `/nabidky/…` nezakazuje a stránky mají data v `__NEXT_DATA__` (Next.js, 50 nabídek na stránku, bez popisu), ale jde o neoficiální scraping; podmínky služby (almacareer.legal) se vykreslují JS a povolení automatického přístupu se nepodařilo ověřit. Překryv s DB (výpis IT vývoj, Praha, 50 nabídek): jen 2 už známe (z hlídače Jobs.cz). Inzeráty jsou nejspíš z Jobs.cz (stejná firma, `itemBrand` s ID inzerenta Alma Career), hlídač Jobs.cz ale posílá jen část – víc pokrytí dá širší hlídač Jobs.cz, ne PZR. |
| StartupJobs.cz | Public API je jen pro firmy (vlastní nabídky, token firmy). Interní `/api/offers` neoficiální. → hlídače, případně dotaz na partnerský feed |
| Profesia.cz | XML feed slouží inzerentům k vkládání nabídek |
| LinkedIn | Podmínky zakazují scraping. → hlídače |
| Indeed | `robots.txt` zakazuje `?rss`, API pro uchazeče není. → hlídače |
| NoFluffJobs, Cocuma, JobStack.it, Welcome to the Jungle | Bez feedu, `robots.txt` blokuje API / vyhledávací dotazy |
| annonce.cz | Chráněno Cloudflare challenge (aktivní blokace automatického přístupu), bez RSS. → hlídací pes e-mailem |
