import { sourcesOverview } from '@job-hunter/core'

// GET /api/sources – přehled zdrojů: typ přístupu, frekvence, počty nabídek, poslední aktivita
export default defineEventHandler(() => sourcesOverview(useDb()))
