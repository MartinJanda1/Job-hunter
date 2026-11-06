import type { RawJob } from '@job-hunter/shared'
import type { IncomingMail } from './ingest'

/**
 * Parser e-mailů jednoho portálu (hlídač nabídek → seznam nabídek).
 * `source` = klíč do SOURCE_LABELS (např. 'mail:jobs.cz'); `id` nabídky `${source}:${externalId}`,
 * kde externalId má být stabilní ID nabídky z odkazu (ne z e-mailu), aby se stejná nabídka
 * z více e-mailů nezdvojila.
 */
export interface MailParser {
  source: string
  /** Odpovídá e-mail tomuto portálu? (podle odesílatele) */
  matches(mail: IncomingMail): boolean
  parse(mail: IncomingMail): RawJob[]
}

// Parsery se doplní podle skutečných e-mailů z hlídačů (uložené v tabulce mail_messages).
// E-maily bez parseru zůstávají nezpracované (parsed_at = null) a zpracují se při dalším
// volání /api/ingest/mail (Apps Script ho volá každou hodinu, i bez nové pošty).
// Po opravě parseru: `update mail_messages set parsed_at = null where parser = '…'`.
export const mailParsers: MailParser[] = []
