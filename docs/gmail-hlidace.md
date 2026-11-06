# Hlídači nabídek přes Gmail

Velké portály (Jobs.cz, Prace.cz, StartupJobs, LinkedIn, Indeed, annonce.cz…) nemají veřejný feed, ale umí posílat nové nabídky e-mailem. Google Apps Script v tvém Gmailu tyto e-maily každou hodinu pošle do aplikace, ta je uloží a parser pro daný portál z nich vytáhne nabídky.

```
portál ──e-mail──▶ Gmail ──Apps Script (1×/h)──▶ POST /api/ingest/mail ──▶ mail_messages ──parser──▶ jobs
```

Synchronizace Gmail jen čte. Volitelné třídění (`setupMailFolder`, níže) založí štítek a Gmail filtr – nic nemaže ani neodesílá.

## 1. Hlídači na portálech

Na každém portálu, který chceš sledovat (Jobs.cz, Prace.cz, StartupJobs.cz, LinkedIn, Indeed, annonce.cz, Cocuma, Profesia), si nastav hlídače – uložené hledání s e-mailovým upozorněním, obvykle u výsledků vyhledávání pod názvem „hlídač“, „hlídací pes“, „upozornění“ nebo „job alert“ – a nech je chodit na svůj Gmail. Čím přesnější hledání (obor, lokalita, klíčová slova), tím méně šumu.

Když přidáš portál, který není v seznamu `SENDERS` v `apps-script/Code.gs`, doplň tam jeho doménu.

## 2. Apps Script

1. Otevři https://script.google.com → **New project**, pojmenuj ho „Job-hunter“.
2. Obsah `Code.gs` nahraď souborem [apps-script/Code.gs](../apps-script/Code.gs) z repa.
3. ⚙️ **Project Settings → Script Properties → Add script property**:
   - `APP_URL` = `https://job-hunter-six-kappa.vercel.app`
   - `INGEST_SECRET` = hodnota `INGEST_SECRET` ze souboru `.env.local` (po `vercel env pull .env.local`)
4. V editoru vyber funkci **`install`** → **Run**. Google se zeptá na oprávnění (číst Gmail, posílat požadavky ven) – projde varováním „Google hasn't verified this app“ přes *Advanced → Go to Job-hunter*. Je to tvůj vlastní skript.
5. Vyber funkci **`syncJobAlerts`** → **Run** pro první běh (projde 14 dní zpětně). V *Execution log* uvidíš odpověď aplikace, např. `{"received":12,"stored":12,"parsed":0,"pending":12,…}`.

Pak běží sám každou hodinu (*Triggers* v levém menu).

## 3. Třídění pošty (štítek místo Doručené pošty)

E-maily od portálů se zařadí pod štítek **Job-hunter/Hlídače** a do Doručené pošty nepřijdou. Třídí je přímo Gmail filtrem hned při doručení; aplikace je dál dostává (Apps Script hledá v celé poště, nejen v Doručené).

1. V editoru Apps Scriptu vlevo **Services (+)** → najdi **Gmail API** → **Add** (potřeba pro vytvoření filtru).
2. Vyber funkci **`setupMailFolder`** → **Run** a povol nová oprávnění (správa nastavení Gmailu / filtrů).
3. V logu uvidíš vytvořený filtr a kolik konverzací se přesunulo z Doručené pošty.

Filtr pak najdeš v Gmailu: ⚙️ → *Zobrazit všechna nastavení* → *Filtry a blokované adresy*. Po změně `SENDERS` spusť `setupMailFolder` znovu – starý filtr nahradí.

**Pozor:** filtr bere celé domény portálů (např. `indeed.com`, `startupjobs.cz`). Pokud ti přes portál odpoví firma (pozvánka na pohovor), přijde to taky pod štítek, ne do Doručené pošty. Nic se nemaže – jen to hledej pod štítkem. Až budou známé adresy, ze kterých chodí jen hlídače, dá se filtr zúžit.

## 4. Parsery

Nové e-maily se ukládají do tabulky `mail_messages`. Dokud pro portál není parser (`packages/core/src/mail/parsers.ts`), zůstávají ve stavu `pending`. Parsery vznikají podle skutečných e-mailů – po přidání parseru se čekající e-maily zpracují samy při dalším hodinovém běhu.

Hotové parsery: **Jobs.cz**, **LinkedIn**. Nový parser se ověří nanečisto: `npm run mail:dryrun -- <část adresy odesílatele>`.

## Změna INGEST_SECRET

Nová hodnota musí být ve Vercel env (`vercel env add INGEST_SECRET …`) i ve Script Properties Apps Scriptu.
