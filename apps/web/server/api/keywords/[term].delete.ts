import { deleteKeyword } from '@job-hunter/core'

// DELETE /api/keywords/:term – smaže klíčové slovo a přepočítá nabídky
export default defineEventHandler(async (event) => {
  const term = getRouterParam(event, 'term', { decode: true }) ?? ''
  const result = await deleteKeyword(useDb(), term)
  if (!result) throw createError({ statusCode: 404, statusMessage: `Klíčové slovo „${term}“ neexistuje` })
  return result
})
