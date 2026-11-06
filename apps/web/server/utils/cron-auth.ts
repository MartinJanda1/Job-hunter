import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/** Ověří hlavičku `Authorization: Bearer <hodnota proměnné envName>`; jinak 401. */
export function requireBearer(event: H3Event, envName: 'CRON_SECRET' | 'INGEST_SECRET'): void {
  const secret = process.env[envName]
  if (!secret) throw createError({ statusCode: 500, statusMessage: `${envName} není nastaven` })

  const given = Buffer.from(getHeader(event, 'authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

/** Cron endpointy smí volat jen plánovač (GitHub Actions) s CRON_SECRET. */
export const requireCronSecret = (event: H3Event) => requireBearer(event, 'CRON_SECRET')
