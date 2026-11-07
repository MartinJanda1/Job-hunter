import { listKeywords } from '@job-hunter/core'

// GET /api/keywords – klíčová slova filtru se statistikou (kolik nabídek v lokalitě slovo obsahuje)
export default defineEventHandler(() => listKeywords(useDb()))
