import { setKeywordEnabled } from '@job-hunter/core'

// PATCH /api/keywords/:term { enabled } – zapne/vypne klíčové slovo a přepočítá nabídky
export default defineEventHandler(async (event) => {
  const term = getRouterParam(event, 'term', { decode: true }) ?? ''
  const body = await readBody<{ enabled?: unknown }>(event)
  if (typeof body?.enabled !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Očekávám { enabled: true|false }' })

  const result = await setKeywordEnabled(useDb(), term, body.enabled)
  if (!result) throw createError({ statusCode: 404, statusMessage: `Klíčové slovo „${term}“ neexistuje` })
  return result
})
