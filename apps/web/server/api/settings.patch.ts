import { updateSettings } from '@job-hunter/core'

// PATCH /api/settings { czechOnly: boolean } – nastavení filtru; přepočítá nabídky, vrací KeywordsResponse
export default defineEventHandler(async (event) => {
  const body = await readBody<{ czechOnly?: unknown }>(event)
  if (typeof body?.czechOnly !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Očekávám { czechOnly: true|false }' })
  return updateSettings(useDb(), { czechOnly: body.czechOnly })
})
