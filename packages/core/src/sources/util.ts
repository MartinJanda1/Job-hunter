import type { SourceState } from '@job-hunter/shared'

/**
 * Omezení frekvence: true = od posledního stažení ještě neuběhlo `hours` hodin, zdroj se teď přeskočí.
 * Pro API, která žádají o málo dotazů za den (Remotive max. 4×/den); cron běží častěji.
 */
export function isThrottled(prevState: SourceState | undefined, hours: number): boolean {
  const last = prevState?.fetchedAt ? Date.parse(prevState.fetchedAt) : NaN
  return Number.isFinite(last) && Date.now() - last < hours * 3_600_000
}

/** Stav k uložení po úspěšném stažení (pro isThrottled) */
export const fetchedNow = (): SourceState => ({ fetchedAt: new Date().toISOString() })

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** HTML popis nabídky → prostý text (pro filtr klíčových slov a zobrazení) */
export function htmlToText(html: string | null | undefined): string | undefined {
  if (!html) return undefined
  const text = html
    .replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === '#'
        ? String.fromCodePoint(e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
  return text || undefined
}

/**
 * Oprava „mojibake“: text v UTF-8, který někdo cestou přečetl jako Latin-1 (např. „â¢“ místo „•“).
 * API Remote OK takto posílá všechny ne-ASCII znaky. Převádí se jen, když jsou všechny znaky
 * v rozsahu Latin-1 a výsledek je platné UTF-8 – správně zakódovaný text zůstane beze změny.
 */
export function fixMojibake<T extends string | undefined>(s: T): T {
  if (!s || !/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s
  const fixed = Buffer.from(s, 'latin1').toString('utf8')
  return (fixed.includes('�') ? s : fixed) as T
}

/** Společné hlavičky pro HTTP požadavky na zdroje */
export const HTTP_HEADERS = { 'User-Agent': 'job-hunter (personal job search; github.com/MartinJanda1/Job-hunter)' }
