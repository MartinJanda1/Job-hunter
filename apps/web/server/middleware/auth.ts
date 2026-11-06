// Celá aplikace je za přihlášením, kromě:
// - přihlašovací stránky a jejího API,
// - strojových endpointů s vlastním tokenem (/api/cron/* – CRON_SECRET, /api/ingest/* – INGEST_SECRET),
// - statických souborů buildu (neobsahují data).
const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/api/cron/', '/api/ingest/', '/_nuxt/', '/__nuxt', '/favicon']

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0] ?? '/'
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return
  if (isLoggedIn(event)) return

  if (path.startsWith('/api/')) throw createError({ statusCode: 401, statusMessage: 'Nepřihlášen' })
  return sendRedirect(event, `/login?next=${encodeURIComponent(path)}`, 302)
})
