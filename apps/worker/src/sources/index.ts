import type { JobSource } from '@job-hunter/shared'
import { rssSource } from './rss.js'

// Každý nový zdroj (adaptér) stačí přidat do tohoto pole.
export const sources: JobSource[] = [rssSource]
