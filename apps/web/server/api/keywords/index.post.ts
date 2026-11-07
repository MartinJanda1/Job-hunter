import { addKeyword, validateNewKeyword } from '@job-hunter/core'

// POST /api/keywords { term } – přidá (zapnuté) klíčové slovo a přepočítá nabídky
export default defineEventHandler(async (event) => {
  const body = await readBody<{ term?: unknown }>(event)
  const db = useDb()
  const valid = await validateNewKeyword(db, body?.term)
  if (typeof valid === 'string') throw createError({ statusCode: 400, statusMessage: valid })
  return addKeyword(db, valid.term)
})
