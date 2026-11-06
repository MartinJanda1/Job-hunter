/**
 * Notifikace do telefonu přes ntfy.sh.
 * V telefonu nainstalujte aplikaci „ntfy“ a přihlaste se k odběru tématu NTFY_TOPIC.
 * Název tématu volte dlouhý a náhodný – kdo ho zná, vidí vaše notifikace.
 */
export async function notify(title: string, message: string, url?: string): Promise<void> {
  const server = process.env.NTFY_SERVER ?? 'https://ntfy.sh'
  const topic = process.env.NTFY_TOPIC
  if (!topic) {
    console.log(`[notify] (NTFY_TOPIC není nastaven) ${title}: ${message}`)
    return
  }

  const headers: Record<string, string> = { Title: encodeURIComponent(title) }
  if (url) headers.Click = url

  const res = await fetch(`${server}/${topic}`, { method: 'POST', body: message, headers })
  if (!res.ok) console.error(`[notify] ntfy vrátil ${res.status}`)
}
