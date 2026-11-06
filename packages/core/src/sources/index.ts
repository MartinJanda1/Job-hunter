import type { JobSource } from '@job-hunter/shared'
import { rssSource } from './rss'

// Každý nový zdroj (adaptér) stačí přidat do tohoto pole.
export const sources: JobSource[] = [rssSource]
