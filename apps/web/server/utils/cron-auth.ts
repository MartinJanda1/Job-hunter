import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/** Cron endpointy smí volat jen plánovač s hlavičkou `Authorization: Bearer $CRON_SECRET`. */
export function requireCronSecret(event: H3Event): void {
  const secret = process.env.CRON_SECRET
  if (!secret) throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET není nastaven' })

  const given = Buffer.from(getHeader(event, 'authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
