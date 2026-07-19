import pg from 'pg'
import { config } from './config.js'
import { verifiedDatabaseSsl, withoutSslQueryParameters } from './database-ssl.js'

const { Pool } = pg

export const localPool = new Pool({ connectionString: config.LOCAL_DATABASE_URL, max: 10, application_name: 'vaultbase-local' })

export function createMirrorPool() {
  if (!config.MIRROR_DATABASE_URL) throw new Error('MIRROR_DATABASE_URL is not configured.')
  return new Pool({ connectionString: withoutSslQueryParameters(config.MIRROR_DATABASE_URL), max: 2, ssl: verifiedDatabaseSsl(), application_name: 'vaultbase-mirror' })
}
