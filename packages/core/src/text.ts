/** Malá písmena bez diakritiky – „Kodér“ i „koder“ se porovnají stejně. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
