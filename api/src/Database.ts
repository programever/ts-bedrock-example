import { Pool } from "pg"
import { Kysely, PostgresDialect } from "kysely"
import ENV from "./Env"

export type Schema = {
  user: UserTable
  refresh_token: RefreshTokenTable
}

type UserTable = {
  id: string
  email: string
  name: string
  password: string
  isDeleted: boolean
  updatedAt: Date
  createdAt: Date
}

type RefreshTokenTable = {
  id: string
  previousID: string
  previousCreatedAt: Date
  userID: string
  createdAt: Date
}

// Export for test to close pool
export const pool = new Pool({
  host: ENV.DB_HOST,
  user: ENV.DB_USER,
  password: ENV.DB_PASSWORD,
  database: process.env.JEST_WORKER_ID
    ? ENV.DB_DATABASE + process.env.JEST_WORKER_ID
    : ENV.DB_DATABASE,
  port: process.env.JEST_WORKER_ID
    ? ENV.DB_PORT + Number(process.env.JEST_WORKER_ID) - 1
    : ENV.DB_PORT,
  max: ENV.DB_MAX_POOL,
  ssl:
    ENV.NODE_ENV === "production"
      ? {
          // RDS issues a self-signed cert but we don't really want to verify
          // since it is all in a private subnet
          rejectUnauthorized: false,
        }
      : false,
})

const db = new Kysely<Schema>({
  dialect: new PostgresDialect({
    pool,
  }),
})

export default db

// HELPER FUNCTIONS

/**
 * For Postgres only, unique constraint violation is code 23505
 */
export function isUniqueConstraintViolation(e: Error): boolean {
  return "code" in e && e.code === "23505"
}
