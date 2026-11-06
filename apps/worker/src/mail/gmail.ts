/**
 * Gmail integrace (TODO).
 *
 * Postup:
 * 1. Google Cloud Console → nový projekt → zapnout „Gmail API“.
 * 2. OAuth consent screen (External, testovací uživatel = váš Gmail).
 * 3. Credentials → OAuth client ID (Web application), redirect URI z .env.
 * 4. npm i googleapis -w apps/worker
 *
 * Funkce, které tu vzniknou:
 * - createDraft(to, subject, body)   → koncept odpovědi na nabídku (schvalujete ručně)
 * - checkInbox()                     → nové zprávy od firem, třídění na pohovor / odmítnutí / dotaz
 */
export async function checkInbox(): Promise<void> {
  console.log('[gmail] checkInbox – zatím neimplementováno')
}
