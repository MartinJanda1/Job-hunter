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

/**
 * Zobrazované názvy zdrojů (klíč = `JobSource.name`). Remotive a Remote OK podmínkami API
 * vyžadují uvedení zdroje u nabídky – UI ho proto zobrazuje vždy.
 */
export const SOURCE_LABELS: Record<string, string> = {
  mpsv: 'Úřad práce ČR',
  remotive: 'Remotive',
  remoteok: 'Remote OK',
  rss: 'We Work Remotely',
  jooble: 'Jooble',
  jobscz: 'Jobs.cz (hlídač)',
  linkedin: 'LinkedIn (hlídač)',
}

/** Kategorie příchozí pošty */
export type MailCategory = 'interview' | 'rejection' | 'question' | 'other'
