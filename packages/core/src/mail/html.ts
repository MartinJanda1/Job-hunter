/** Pomocné funkce pro rozbor HTML e-mailů (bez DOM knihovny – e-maily jsou tabulkové a stačí regexy). */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (ENTITIES[e.toLowerCase()] ?? m),
  )
}

/** Textové kousky HTML v pořadí (každý textový uzel zvlášť, prázdné vynechány) */
export function textPieces(html: string): string[] {
  return html
    .replace(/<(style|head|script)\b[\s\S]*?<\/\1>/gi, '')
    .split(/<[^>]*>/)
    .map((t) => decodeEntities(t).replace(/[\s͏​-‍⁠﻿]+/g, ' ').trim())
    .filter(Boolean)
}

export interface Anchor {
  href: string
  index: number // pozice začátku <a> v HTML
}

/** Všechny odkazy <a href> v HTML, jejichž href odpovídá vzoru */
export function anchors(html: string, hrefPattern: RegExp): Anchor[] {
  return [...html.matchAll(/<a\b[^>]*?href="([^"]+)"[^>]*>/gi)]
    .map((m) => ({ href: decodeEntities(m[1]!), index: m.index! }))
    .filter((a) => hrefPattern.test(a.href))
}

/** HTML od odkazu `list[i]` po další odkaz ze seznamu (= „karta“ nabídky) */
export function blockAfter(html: string, list: Anchor[], i: number, maxLen = 6000): string {
  const start = list[i]!.index
  const end = list[i + 1]?.index ?? start + maxLen
  return html.slice(start, Math.min(end, start + maxLen))
}
