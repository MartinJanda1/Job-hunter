import type { SearchCriteria } from '@job-hunter/shared'

// Zatím natvrdo – později se budou načítat z databáze a upravovat ve webovém UI.
// Po změně se při dalším běhu hledání automaticky přepočítá stav všech uložených nabídek (viz refilter.ts).
// Porovnává se bez ohledu na velikost písmen a diakritiku, po celých slovech („vue“ nenajde „revue“).
export const criteria: SearchCriteria = {
  // Zásadní výrazy podle CV (front-end, Vue) – postupně doplňovat.
  keywords: [
    'vue', 'vuejs', 'nuxt',
    'frontend', 'front-end', 'front end',
    'javascript', 'typescript',
    'kodér',
    'webmaster',
  ],
  // Nabídka bez lokality nebo s jinou lokalitou neprojde. Aliasy (Prague, Hlavní město Praha…) v filter.ts.
  locations: ['Praha'],
  remoteOnly: false,
  excludeKeywords: [],
}
