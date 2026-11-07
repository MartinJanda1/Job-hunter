// Sdílené typy pro web i worker

/** Kritéria, podle kterých hledáme nabídky */
export interface SearchCriteria {
  keywords: string[]          // např. ["vue", "node.js", "frontend"]
  locations: string[]         // např. ["Praha", "remote"]
  remoteOnly?: boolean
  minSalaryCzk?: number
  excludeKeywords?: string[]  // např. ["senior", "php"]
}

/** Stav nabídky v našem „pipeline“ */
export type JobStatus =
  | 'new'        // právě nalezená
  | 'matched'    // prošla filtrem / dobré skóre
  | 'rejected'   // vyřazená filtrem nebo ručně
  | 'drafted'    // připravená odpověď čeká na schválení
  | 'applied'    // odesláno
  | 'interview'  // pozvánka na pohovor
  | 'declined'   // odmítnutí od firmy

/** Jedna pracovní nabídka v jednotném tvaru (bez ohledu na zdroj) */
export interface Job {
  id: string            // `${source}:${externalId}`
  source: string        // název adaptéru, např. "rss"
  externalId: string
  title: string
  company?: string
  location?: string
  remote?: boolean
  salaryText?: string
  url: string
  description?: string
  publishedAt?: string  // ISO datum
  foundAt: string       // ISO datum
  score?: number        // 0–100, shoda s CV (LLM)
  scoreReason?: string
  status: JobStatus
}

/** Nabídka tak, jak ji vrací zdroj – bez polí, která doplní pipeline */
export type RawJob = Omit<Job, 'foundAt' | 'status'>

/** Libovolný stav zdroje mezi běhy (např. ETag), ukládá se do DB */
export type SourceState = Record<string, string>

export interface FetchResult {
  jobs: RawJob[]
  /** Nový stav k uložení – jen po úspěšném zpracování všech nabídek */
  state?: SourceState
}

/** Rozhraní, které implementuje každý zdroj nabídek */
export interface JobSource {
  name: string
  fetchJobs(criteria: SearchCriteria, prevState?: SourceState): Promise<FetchResult>
}

/** Popis zdroje pro UI (klíč = `JobSource.name`, resp. `MailParser.source`) */
export interface SourceInfo {
  label: string
  /** Způsob přístupu */
  kind: 'Otevřená data' | 'API' | 'RSS' | 'E-mail (hlídač)'
  /** Jak často se prochází */
  schedule: string
  url: string
}

/**
 * Všechny zdroje nabídek. Remotive a Remote OK podmínkami API vyžadují uvedení zdroje
 * u nabídky – UI ho proto zobrazuje vždy. Nový zdroj = přidat sem.
 */
export const SOURCES: Record<string, SourceInfo> = {
  mpsv: { label: 'Úřad práce ČR', kind: 'Otevřená data', schedule: '1× denně (při změně dat)', url: 'https://data.mpsv.cz' },
  jooble: { label: 'Jooble', kind: 'API', schedule: '1× denně', url: 'https://cz.jooble.org' },
  remotive: { label: 'Remotive', kind: 'API', schedule: '1× za 6 h', url: 'https://remotive.com' },
  remoteok: { label: 'Remote OK', kind: 'API', schedule: '1× za 6 h', url: 'https://remoteok.com' },
  rss: { label: 'We Work Remotely', kind: 'RSS', schedule: 'každé 2 h', url: 'https://weworkremotely.com' },
  jobscz: { label: 'Jobs.cz', kind: 'E-mail (hlídač)', schedule: 'každou hodinu', url: 'https://www.jobs.cz' },
  linkedin: { label: 'LinkedIn', kind: 'E-mail (hlídač)', schedule: 'každou hodinu', url: 'https://www.linkedin.com/jobs' },
}

/** Zobrazované názvy zdrojů (odvozené ze SOURCES) */
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCES).map(([key, s]) => [key, s.label]),
)

/** GET /api/sources – jeden řádek přehledu zdrojů */
export interface SourceView extends SourceInfo {
  key: string
  total: number         // nabídek v DB
  matched: number       // z toho vhodných
  lastFoundAt?: string  // kdy přibyla poslední nabídka (ISO)
  lastCheckedAt?: string // kdy se zdroj naposledy úspěšně stáhl (ISO; jen zdroje se stavem)
}

/** Klíčové slovo filtru */
export interface KeywordView {
  term: string
  enabled: boolean
  /** Kolik nabídek v DB v hledané lokalitě slovo obsahuje (bez ohledu na ostatní slova) */
  count: number
}

/** GET /api/keywords */
export interface KeywordsResponse {
  locations: string[]
  keywords: KeywordView[]
  /** Kolik nabídek je teď vhodných (status matched) */
  matched: number
}

/** Kategorie příchozí pošty */
export type MailCategory = 'interview' | 'rejection' | 'question' | 'other'
