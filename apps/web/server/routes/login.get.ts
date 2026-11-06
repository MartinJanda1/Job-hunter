// GET /login – přihlašovací formulář (čisté HTML ze serveru, nezávislé na Vue aplikaci).
export default defineEventHandler((event) => {
  if (isLoggedIn(event)) return sendRedirect(event, '/', 302)

  const query = getQuery(event)
  const next = typeof query.next === 'string' && query.next.startsWith('/') ? query.next : '/'
  const error = query.error ? '<p class="err">Nesprávné heslo.</p>' : ''
  const escapeAttr = (s: string) => s.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`)

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-store')
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Job-hunter – přihlášení</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f6f7f9; color: #1d1f23; display: grid; place-items: center; min-height: 100vh; }
  form { background: #fff; border: 1px solid #e3e5e8; border-radius: 10px; padding: 24px; width: min(320px, calc(100vw - 32px)); box-sizing: border-box; display: grid; gap: 12px; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #c9ccd1; }
  button { background: #1d1f23; color: #fff; border: 0; cursor: pointer; }
  .err { color: #b42318; margin: 0; }
</style>
</head>
<body>
<form method="post" action="/api/auth/login">
  <h1>Job-hunter</h1>
  ${error}
  <input type="password" name="password" placeholder="Heslo" autocomplete="current-password" required autofocus>
  <input type="hidden" name="next" value="${escapeAttr(next)}">
  <button type="submit">Přihlásit</button>
</form>
</body>
</html>`
})
