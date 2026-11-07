import type { TextPart } from '@job-hunter/shared'
import { normalize, termPatternSource } from './filter'

type Range = [start: number, end: number]

/**
 * Normalizovaný text (bez diakritiky, malá písmena) + mapa „index v normalizovaném → index v původním“.
 * Díky mapě jde shodu nalezenou v normalizovaném textu zvýraznit v původním (s diakritikou).
 */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!)
    const n = normalize(ch)
    for (let k = 0; k < n.length; k++) map.push(i)
    norm += n
    i += ch.length
  }
  map.push(text.length)
  return { norm, map }
}

/** Najde výskyty výrazů (celá slova, bez diakritiky) – sloučené úseky v původním textu + které výrazy se našly. */
export function findTerms(text: string, terms: string[]): { ranges: Range[]; found: string[] } {
  if (!text || !terms.length) return { ranges: [], found: [] }
  const { norm, map } = normalizeWithMap(text)
  const ranges: Range[] = []
  const found: string[] = []
  for (const term of terms) {
    let hit = false
    for (const m of norm.matchAll(new RegExp(termPatternSource(term), 'g'))) {
      ranges.push([map[m.index]!, map[m.index + m[0].length]!])
      hit = true
    }
    if (hit) found.push(term)
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Range[] = []
  for (const r of ranges) {
    const last = merged.at(-1)
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  return { ranges: merged, found }
}

/** Rozdělí text na úseky se zvýrazněním */
export function toParts(text: string, ranges: Range[]): TextPart[] {
  const parts: TextPart[] = []
  let pos = 0
  for (const [s, e] of ranges) {
    if (s > pos) parts.push({ text: text.slice(pos, s) })
    parts.push({ text: text.slice(s, e), hit: true })
    pos = e
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) })
  return parts
}

/**
 * Úryvek kolem prvního výskytu (± radius znaků, na hranicích slov); bez výskytu začátek textu.
 * `ranges` musí pocházet z findTerms nad stejným `text` (volající text předem zbaví vícenásobných mezer).
 */
export function excerpt(text: string, ranges: Range[], radius = 120): TextPart[] {
  const first = ranges[0]
  let start = first ? Math.max(0, first[0] - radius) : 0
  let end = first ? Math.min(text.length, first[1] + radius) : Math.min(text.length, radius * 2)
  if (start > 0) start = text.indexOf(' ', start) + 1 || start
  if (end < text.length) end = text.lastIndexOf(' ', end) > start ? text.lastIndexOf(' ', end) : end

  const inside = ranges
    .filter(([s, e]) => e > start && s < end)
    .map(([s, e]): Range => [Math.max(s, start) - start, Math.min(e, end) - start])
  const parts = toParts(text.slice(start, end), inside)
  if (start > 0) parts.unshift({ text: '… ' })
  if (end < text.length) parts.push({ text: ' …' })
  return parts
}
