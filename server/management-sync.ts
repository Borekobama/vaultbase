import { writeFile } from 'node:fs/promises'
import { secretStore } from './secret-store.js'

const managementBaseUrl = 'https://api.supabase.com'
const configEndpoints = [
  ['auth', 'auth_config_read', '/v1/projects/{ref}/config/auth'],
  ['storage', 'storage_config_read', '/v1/projects/{ref}/config/storage'],
  ['realtime', 'realtime_config_read', '/v1/projects/{ref}/config/realtime'],
  ['dataApi', 'data_api_config_read', '/v1/projects/{ref}/postgrest'],
  ['postgres', 'database_config_read', '/v1/projects/{ref}/config/database/postgres'],
  ['pooler', 'database_pooling_config_read', '/v1/projects/{ref}/config/database/pooler'],
] as const

async function managementRequest(path: string, accessToken: string) {
  const response = await fetch(`${managementBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : `Supabase Management API returned ${response.status}.`
    throw Object.assign(new Error(message), { status: response.status })
  }
  return body
}

export async function validateManagementCredentials(projectRef: string, accessToken: string) {
  await managementRequest(`/v1/projects/${encodeURIComponent(projectRef)}`, accessToken)
}

export async function syncManagementConfiguration(projectId: string, projectRef: string, destination: string) {
  const reference = `supabase/${projectId}/management-api`
  if (!(await secretStore.has(reference))) return { configured: false, captured: 0, warnings: [] as string[] }
  const accessToken = await secretStore.get(reference)
  const configuration: Record<string, unknown> = {}
  const warnings: string[] = []
  for (const [name, permission, template] of configEndpoints) {
    try {
      configuration[name] = await managementRequest(template.replace('{ref}', encodeURIComponent(projectRef)), accessToken)
    } catch (error) {
      const status = Number((error as { status?: number }).status)
      if (status === 401) throw new Error('Management API credentials are no longer valid.')
      warnings.push(`${name} configuration was skipped; grant ${permission}.`)
    }
  }
  await writeFile(destination, `${JSON.stringify({ capturedAt: new Date().toISOString(), projectRef, configuration }, null, 2)}\n`, { mode: 0o600 })
  return { configured: true, captured: Object.keys(configuration).length, warnings }
}
