import { defineConfig } from 'drizzle-kit'

// Lokálně: proměnné z `vercel env pull .env.local` (kořen repa). V CI je dodá prostředí.
try {
  process.loadEnvFile('../../.env.local')
} catch {}

// Migrace přes přímé (nepoolované) spojení – doporučení Neonu pro DDL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: url! },
})
