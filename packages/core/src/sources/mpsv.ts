import { Readable } from 'node:stream'
import chain from 'stream-chain'
import { parser } from 'stream-json'
import { pick } from 'stream-json/filters/pick.js'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import type { JobSource, RawJob } from '@job-hunter/shared'

/**
 * Úřad práce ČR – otevřená data MPSV (volná pracovní místa).
 * Oficiální datová sada, přístup povolen. ~190 MB JSON, aktualizace 1× denně.
 *
 * - Soubor se čte streamem (do paměti se nikdy nenačte celý) a ponechají se jen IT profese.
 * - Stahuje se podmíněně podle ETagu – když se soubor od minula nezměnil, server vrátí 304.
 */
const DATASET_URL = 'https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json'

/** CZ-ISCO: 25 = specialisté v oblasti ICT, 35 = technici ICT */
const IT_ISCO = /^(25|35)/

/**
 * Detail nabídky v aplikaci Úřadu práce (up.gov.cz, dřív uradprace.cz – staré vyhledávání vrací 404).
 * Routa `#/volna-mista-detail/<id>` je z kódu aplikace (volna-mista-app.js), id = portalId z datové sady.
 */
export const upDetailUrl = (portalId: number | string) => `https://up.gov.cz/volna-mista-v-cr#/volna-mista-detail/${portalId}`

/** Kódy krajů (RÚIAN) → název, pro lokalitu, když chybí textová adresa */
const KRAJE: Record<string, string> = {
  '19': 'Praha', '27': 'Středočeský kraj', '35': 'Jihočeský kraj', '43': 'Plzeňský kraj',
  '51': 'Karlovarský kraj', '60': 'Ústecký kraj', '78': 'Liberecký kraj', '86': 'Královéhradecký kraj',
  '94': 'Pardubický kraj', '108': 'Kraj Vysočina', '116': 'Jihomoravský kraj', '124': 'Olomoucký kraj',
  '132': 'Moravskoslezský kraj', '141': 'Zlínský kraj',
}

/** Jen pole, která používáme (datová sada jich má víc) */
interface VolneMisto {
  portalId: number
  referencniCislo?: string
  datumVlozeni?: string
  mesicniMzdaOd?: number | null
  mesicniMzdaDo?: number | null
  typMzdy?: { id?: string } | null
  pozadovanaProfese?: { cs?: string } | null
  upresnujiciInformace?: { cs?: string } | null
  urlAdresa?: string | null
  zamestnavatel?: { nazev?: string } | null
  profeseCzIsco?: { id?: string } | null
  mistoVykonuPrace?: {
    adresaText?: string | null
    pracoviste?: { adresa?: { dodatekAdresy?: string | null; kraj?: { id?: string } | null } | null }[] | null
  } | null
}

const idPart = (ref?: { id?: string } | null) => ref?.id?.split('/')[1] ?? ''

function salaryText(v: VolneMisto): string | undefined {
  const fmt = (n: number) => n.toLocaleString('cs-CZ')
  const { mesicniMzdaOd: od, mesicniMzdaDo: do_ } = v
  if (!od && !do_) return undefined
  const range = od && do_ && od !== do_ ? `${fmt(od)} – ${fmt(do_)}` : fmt((od ?? do_)!)
  const unit = idPart(v.typMzdy) === 'hodina' ? 'Kč/hod' : 'Kč/měsíc'
  return `${range} ${unit}`
}

function location(v: VolneMisto): string | undefined {
  const misto = v.mistoVykonuPrace
  const adresa = misto?.pracoviste?.[0]?.adresa
  return misto?.adresaText || adresa?.dodatekAdresy || KRAJE[idPart(adresa?.kraj)] || undefined
}

function toJob(v: VolneMisto): RawJob {
  const ref = v.referencniCislo ? `Ref. č. ÚP: ${v.referencniCislo}` : ''
  return {
    id: `mpsv:${v.portalId}`,
    source: 'mpsv',
    externalId: String(v.portalId),
    title: v.pozadovanaProfese?.cs?.trim() || '(bez názvu)',
    company: v.zamestnavatel?.nazev ?? undefined,
    location: location(v),
    salaryText: salaryText(v),
    url: v.urlAdresa || upDetailUrl(v.portalId),
    description: [v.upresnujiciInformace?.cs, ref].filter(Boolean).join('\n\n') || undefined,
    publishedAt: v.datumVlozeni,
  }
}

export const mpsvSource: JobSource = {
  name: 'mpsv',
  async fetchJobs(_criteria, prevState) {
    const headers: Record<string, string> = {}
    if (prevState?.etag) headers['If-None-Match'] = prevState.etag

    const res = await fetch(DATASET_URL, { headers, signal: AbortSignal.timeout(120_000) })
    if (res.status === 304) {
      console.log('[mpsv] datová sada se nezměnila (304)')
      return { jobs: [] }
    }
    if (!res.ok || !res.body) throw new Error(`MPSV vrátilo ${res.status}`)

    const jobs: RawJob[] = []
    let total = 0
    const pipeline = chain([
      Readable.fromWeb(res.body as import('node:stream/web').ReadableStream),
      parser(),
      pick({ filter: 'polozky' }),
      streamArray(),
    ])
    for await (const { value } of pipeline as AsyncIterable<{ value: VolneMisto }>) {
      total++
      if (IT_ISCO.test(idPart(value.profeseCzIsco))) jobs.push(toJob(value))
    }

    console.log(`[mpsv] ${total} nabídek v datové sadě, z toho IT: ${jobs.length}`)
    const etag = res.headers.get('etag')
    return { jobs, state: etag ? { etag } : undefined }
  },
}
