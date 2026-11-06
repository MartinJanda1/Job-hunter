import type { JobSource } from '@job-hunter/shared'
import { joobleSource } from './jooble'
import { mpsvSource } from './mpsv'
import { remoteOkSource } from './remoteok'
import { remotiveSource } from './remotive'
import { rssSource } from './rss'

// Každý nový zdroj (adaptér) stačí přidat do tohoto pole a jeho zobrazovaný název do SOURCE_LABELS (packages/shared).
// Přehled prověřených zdrojů: docs/zdroje.md
export const sources: JobSource[] = [mpsvSource, joobleSource, remotiveSource, remoteOkSource, rssSource]
