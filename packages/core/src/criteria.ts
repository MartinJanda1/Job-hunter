import type { SearchCriteria } from '@job-hunter/shared'

// Zatím natvrdo – později se budou načítat z databáze a upravovat ve webovém UI.
export const criteria: SearchCriteria = {
  keywords: ['vue', 'node.js', 'javascript', 'frontend'],
  locations: ['Praha', 'remote'],
  remoteOnly: false,
  excludeKeywords: ['php', 'java '],
}
