import { Client } from 'pg'
import { verifiedDatabaseSsl, withoutSslQueryParameters } from './database-ssl.js'
import { secretStore } from './secret-store.js'

export async function validateDatabaseConnection(databaseUrl: string, applicationName = 'vaultbase-credential-check') {
  const hostname = new URL(databaseUrl).hostname
  const client = new Client({
    connectionString: withoutSslQueryParameters(databaseUrl),
    ssl: ['localhost', '127.0.0.1'].includes(hostname) ? false : verifiedDatabaseSsl(),
    connectionTimeoutMillis: 15_000,
    query_timeout: 15_000,
    application_name: applicationName,
  })
  try {
    await client.connect()
    await client.query('SELECT current_user')
  } finally {
    await client.end().catch(() => undefined)
  }
}

export function databaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : 'connection failed'
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code === 'ENOTFOUND' || /getaddrinfo ENOTFOUND/i.test(message)) {
    return 'the hostname has no DNS record reachable from this server'
  }
  if (code === 'ENETUNREACH' || /network is unreachable/i.test(message)) {
    return 'the route is IPv6-only, but this Vaultbase server cannot reach IPv6'
  }
  if (code === 'ETIMEDOUT' || /timed out|timeout/i.test(message)) {
    return 'the connection timed out'
  }
  return message
}

export async function resolveDatabaseConnection(primaryReference: string, directReference?: string | null) {
  const candidates = [
    { route: 'session', reference: primaryReference },
    ...(directReference && await secretStore.has(directReference) ? [{ route: 'direct', reference: directReference }] : []),
  ]
  const failures: string[] = []
  for (const candidate of candidates) {
    const databaseUrl = await secretStore.get(candidate.reference)
    try {
      await validateDatabaseConnection(databaseUrl, `vaultbase-${candidate.route}-probe`)
      return { databaseUrl, route: candidate.route }
    } catch (error) {
      failures.push(`${candidate.route}: ${error instanceof Error ? error.message : 'connection failed'}`)
    }
  }
  throw new Error(`No database route was reachable (${failures.join('; ')}).`)
}
