// POST /api/auth/login – formulář z /login (application/x-www-form-urlencoded).
export default defineEventHandler(async (event) => {
  const body = (await readBody<Record<string, string>>(event)) ?? {}
  const next = typeof body.next === 'string' && body.next.startsWith('/') && !body.next.startsWith('//') ? body.next : '/'

  if (!checkPassword(String(body.password ?? ''))) {
    // Zpomalení zkoušení hesel
    await new Promise((r) => setTimeout(r, 1000))
    return sendRedirect(event, `/login?error=1&next=${encodeURIComponent(next)}`, 303)
  }

  startSession(event)
  return sendRedirect(event, next, 303)
})
