import type { JobSource } from '@job-hunter/shared'
import { mpsvSource } from './mpsv'
import { rssSource } from './rss'

// Každý nový zdroj (adaptér) stačí přidat do tohoto pole. Přehled prověřených zdrojů: docs/zdroje.md
export const sources: JobSource[] = [mpsvSource, rssSource]
