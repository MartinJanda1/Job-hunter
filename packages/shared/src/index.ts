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

/** Rozhraní, které implementuje každý zdroj nabídek */
export interface JobSource {
  name: string
  fetchJobs(criteria: SearchCriteria): Promise<Omit<Job, 'foundAt' | 'status'>[]>
}

/** Kategorie příchozí pošty */
export type MailCategory = 'interview' | 'rejection' | 'question' | 'other'
