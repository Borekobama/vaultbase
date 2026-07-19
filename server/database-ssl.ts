import { readFileSync } from 'node:fs'
import { config } from './config.js'

export function verifiedDatabaseSsl() {
  return { rejectUnauthorized: true, ca: readFileSync(config.SUPABASE_CA_BUNDLE_FILE, 'utf8') }
}

export function withoutSslQueryParameters(raw: string) {
  const url = new URL(raw)
  for (const parameter of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(parameter)
  return url.toString()
}

export function postgresSslEnvironment(hostname: string) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return { PGSSLMODE: 'disable' }
  return { PGSSLMODE: 'verify-full', PGSSLROOTCERT: config.SUPABASE_CA_BUNDLE_FILE }
}
