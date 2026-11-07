/** „před 5 min“, „před 3 h“, „před 2 dny“ – pro přehled zdrojů (auto-import v Nuxtu) */
export function timeAgo(iso?: string): string {
  if (!iso) return '–'
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (min < 1) return 'právě teď'
  if (min < 60) return `před ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `před ${h} h`
  const d = Math.round(h / 24)
  return `před ${d} ${d === 1 ? 'dnem' : 'dny'}`
}
