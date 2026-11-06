import { createDb, type Db } from '@job-hunter/core'

let db: Db | undefined

/** Sdílená instance Drizzle pro serverové routy (auto-import v Nitru). */
export function useDb(): Db {
  db ??= createDb()
  return db
}
