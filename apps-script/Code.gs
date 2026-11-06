/**
 * Job-hunter – přeposílání e-mailů z hlídačů pracovních portálů do aplikace.
 *
 * Běží v Google Apps Scriptu pod tvým Google účtem (script.google.com), ne na Vercelu.
 * Každou hodinu najde nové e-maily od portálů a pošle je na POST {APP_URL}/api/ingest/mail.
 * Nic v Gmailu nemění (žádné štítky, mazání ani odesílání) – jen čte.
 *
 * Nastavení: viz docs/gmail-hlidace.md
 *   Project Settings → Script Properties:
 *     APP_URL        https://job-hunter-six-kappa.vercel.app
 *     INGEST_SECRET  stejná hodnota jako ve Vercel env (INGEST_SECRET)
 *   Pak jednou spusť funkci `install` (vytvoří hodinový trigger) a `syncJobAlerts` (první běh).
 */

/** Odesílatelé hlídačů. Gmail `from:` hledá podřetězec adresy, doména tedy pokryje všechny adresy portálu. */
const SENDERS = [
  'jobs.cz',
  'prace.cz',
  'startupjobs.cz',
  'jobalerts-noreply@linkedin.com',
  'indeed.com',
  'annonce.cz',
  'cocuma.cz',
  'profesia.cz',
]

/** První běh: kolik dní zpětně projít */
const FIRST_RUN_DAYS = 14
/** Max. velikost jednoho požadavku (Vercel přijme 4,5 MB) */
const MAX_BATCH_BYTES = 3 * 1024 * 1024
/** Max. velikost HTML jednoho e-mailu (větší se zkrátí) */
const MAX_HTML_BYTES = 1024 * 1024
/** Překryv při dalších bězích – raději e-mail poslat dvakrát (server ho zdvojit nenechá) než vynechat */
const OVERLAP_SECONDS = 3600

function syncJobAlerts() {
  const props = PropertiesService.getScriptProperties()
  const appUrl = props.getProperty('APP_URL')
  const secret = props.getProperty('INGEST_SECRET')
  if (!appUrl || !secret) throw new Error('Chybí Script Properties APP_URL nebo INGEST_SECRET')

  const startedAt = Math.floor(Date.now() / 1000)
  const lastSync = Number(props.getProperty('LAST_SYNC') || 0)
  const since = lastSync ? lastSync - OVERLAP_SECONDS : startedAt - FIRST_RUN_DAYS * 86400

  const query = `from:(${SENDERS.join(' OR ')}) after:${since}`
  const messages = []
  let start = 0
  while (true) {
    const threads = GmailApp.search(query, start, 100)
    for (const thread of threads) {
      for (const m of thread.getMessages()) {
        if (m.getDate().getTime() / 1000 < since) continue
        messages.push({
          id: m.getId(),
          from: m.getFrom(),
          subject: m.getSubject(),
          date: m.getDate().toISOString(),
          html: truncate(m.getBody(), MAX_HTML_BYTES),
        })
      }
    }
    if (threads.length < 100) break
    start += 100
  }

  // I bez nové pošty jedno volání – server při něm zpracuje dřív uložené e-maily, které čekaly na parser.
  const batches = toBatches(messages, MAX_BATCH_BYTES)
  if (!batches.length) batches.push([])
  for (const batch of batches) post(appUrl, secret, batch)

  // Až po úspěšném odeslání všech dávek (post při chybě vyhodí výjimku).
  props.setProperty('LAST_SYNC', String(startedAt))
  console.log(`Odesláno ${messages.length} e-mailů v ${batches.length} dávkách`)
}

function post(appUrl, secret, messages) {
  const res = UrlFetchApp.fetch(`${appUrl.replace(/\/$/, '')}/api/ingest/mail`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${secret}` },
    payload: JSON.stringify({ messages }),
    muteHttpExceptions: true,
  })
  const code = res.getResponseCode()
  if (code < 200 || code >= 300) throw new Error(`Job-hunter vrátil ${code}: ${res.getContentText().slice(0, 500)}`)
  console.log(res.getContentText())
}

function toBatches(messages, maxBytes) {
  const batches = []
  let current = []
  let size = 0
  for (const m of messages) {
    const bytes = Utilities.newBlob(JSON.stringify(m)).getBytes().length
    if (current.length && size + bytes > maxBytes) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(m)
    size += bytes
  }
  if (current.length) batches.push(current)
  return batches
}

function truncate(html, maxBytes) {
  return html.length > maxBytes ? html.slice(0, maxBytes) : html
}

/** Jednorázově: hodinový trigger pro syncJobAlerts (staré triggery této funkce smaže, ať nejsou dvakrát). */
function install() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'syncJobAlerts') ScriptApp.deleteTrigger(t)
  }
  ScriptApp.newTrigger('syncJobAlerts').timeBased().everyHours(1).create()
  console.log('Trigger vytvořen: syncJobAlerts každou hodinu')
}
