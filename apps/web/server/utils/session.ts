import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Jednoduché přihlášení jedním heslem (APP_PASSWORD) bez databáze:
 * cookie = `<expirace>.<HMAC(SESSION_SECRET, expirace)>`. Změna SESSION_SECRET odhlásí všechny.
 */
export const SESSION_COOKIE = 'jh_session'
const SESSION_DAYS = 30

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw createError({ statusCode: 500, statusMessage: 'SESSION_SECRET není nastaven' })
  return s
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('hex')

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function isLoggedIn(event: H3Event): boolean {
  const value = getCookie(event, SESSION_COOKIE)
  if (!value) return false
  const [expires, mac] = value.split('.')
  if (!expires || !mac || !safeEqual(mac, sign(expires))) return false
  return Number(expires) > Date.now()
}

export function startSession(event: H3Event): void {
  const expires = String(Date.now() + SESSION_DAYS * 86_400_000)
  setCookie(event, SESSION_COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

export function endSession(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/** Porovnání hesla v konstantním čase; bez nastaveného APP_PASSWORD se nepřihlásí nikdo. */
export function checkPassword(given: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) return false
  // HMAC obou hodnot → stejná délka, timingSafeEqual neprozradí délku hesla.
  return safeEqual(sign(`pw:${given}`), sign(`pw:${expected}`))
}
