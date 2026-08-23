import { readFileSync } from "node:fs"
import pg from "pg"
const env = readFileSync(new URL("../.env", import.meta.url), "utf8")
const connectionString = /^DATABASE_URL=(.+)$/m.exec(env)[1].trim().replace(/^["']|["']$/g, "")
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 })
const holders = await pool.query(`
  SELECT pid, usename, application_name, client_addr, state, query_start, now() - query_start AS duration, LEFT(query, 80) AS query
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND (query ILIKE '%advisory%' OR (state = 'idle' AND now() - state_change > interval '10 minutes'))
  ORDER BY query_start`)
console.log(JSON.stringify(holders.rows, null, 1))
await pool.end()
