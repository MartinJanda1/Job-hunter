import type { RawJob } from '@job-hunter/shared'
import type { IncomingMail } from './ingest'
import { jobsCzParser } from './parsers/jobscz'
import { linkedInParser } from './parsers/linkedin'

/**
 * Parser e-mailů jednoho portálu (hlídač nabídek → seznam nabídek).
 * `source` = klíč do SOURCE_LABELS (packages/shared); `id` nabídky `${source}:${externalId}`,
 * kde externalId má být stabilní ID nabídky (z odkazu, nebo otisk), aby se stejná nabídka
 * z více e-mailů nezdvojila.
 */
export interface MailParser {
  source: string
  /** Odpovídá e-mail tomuto portálu? (podle odesílatele) */
  matches(mail: IncomingMail): boolean
  parse(mail: IncomingMail): RawJob[]
}

// Parsery vznikají podle skutečných e-mailů z hlídačů (uložené v tabulce mail_messages).
// E-maily bez parseru zůstávají nezpracované (parsed_at = null) a zpracují se při dalším
// volání /api/ingest/mail (Apps Script ho volá každou hodinu, i bez nové pošty).
// Po opravě parseru: `update mail_messages set parsed_at = null where parser = '…'`.
export const mailParsers: MailParser[] = [jobsCzParser, linkedInParser]
