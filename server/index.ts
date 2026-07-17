import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { localPool } from './db.js'
import { migrate } from './migrate.js'
import { syncMirror } from './mirror.js'
import { normalizeProjectId, parseSupabaseDatabaseUrl, projectInputSchema } from './project-input.js'
import { secretStore } from './secret-store.js'
import { createRecoveryPack } from './recovery-pack.js'
import { streamSnapshotDownload } from './snapshot-download.js'
import { verifyResticSnapshot } from './verify-recovery.js'
import { runKeepAlive } from './keep-alive.js'

const app = express()
const sessions = new Map<string, number>()
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '64kb' }))
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }))

function cookies(header: string | undefined) {
  return Object.fromEntries((header ?? '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2))
}

function authenticated(request: express.Request) {
  if (!config.VAULTBASE_API_TOKEN) return config.NODE_ENV !== 'production'
  const bearer = request.header('authorization')?.replace(/^Bearer\s+/i, '')
  if (bearer) {
    const expected = Buffer.from(config.VAULTBASE_API_TOKEN)
    const actual = Buffer.from(bearer)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
  const session = cookies(request.header('cookie')).vaultbase_session
  const expires = session ? sessions.get(session) : undefined
  if (!expires || expires <= Date.now()) { if (session) sessions.delete(session); return false }
  sessions.set(session, Date.now() + SESSION_TTL_MS)
  return true
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
app.post('/api/session', loginLimiter, (request, response) => {
  if (!config.VAULTBASE_API_TOKEN) return response.status(503).json({ error: 'Authentication is not configured.' })
  const supplied = z.object({ key: z.string().min(1).max(512) }).safeParse(request.body)
  if (!supplied.success) return response.status(400).json({ error: 'Enter your Vaultbase key.' })
  const expected = Buffer.from(config.VAULTBASE_API_TOKEN)
  const actual = Buffer.from(supplied.data.key)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return response.status(401).json({ error: 'Invalid Vaultbase key.' })
  const session = randomBytes(32).toString('base64url')
  sessions.set(session, Date.now() + SESSION_TTL_MS)
  response.setHeader('Set-Cookie', `vaultbase_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${config.NODE_ENV === 'production' ? '; Secure' : ''}`)
  response.status(204).end()
})

app.get('/api/session', (request, response) => response.status(authenticated(request) ? 204 : 401).end())
app.delete('/api/session', (request, response) => {
  const session = cookies(request.header('cookie')).vaultbase_session
  if (session) sessions.delete(session)
  response.setHeader('Set-Cookie', `vaultbase_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.NODE_ENV === 'production' ? '; Secure' : ''}`)
  response.status(204).end()
})

app.use('/api', (request, response, next) => {
  if (!authenticated(request)) return response.status(401).json({ error: 'Unauthorized' })
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !request.header('authorization')) {
    const origin = request.header('origin')
    const expected = config.PUBLIC_ORIGIN ?? `${request.protocol}://${request.get('host')}`
    if (request.header('x-vaultbase-csrf') !== '1' || (origin && origin !== expected)) return response.status(403).json({ error: 'Invalid request origin.' })
  }
  next()
})

app.get('/health', async (_request, response) => {
  try {
    await localPool.query('SELECT 1')
    response.json({ status: 'ok', database: 'local-postgresql', mirrorEnabled: config.MIRROR_ENABLED })
  } catch { response.status(503).json({ status: 'unavailable' }) }
})

app.get('/api/mirror/status', async (_request, response) => {
  const result = await localPool.query('SELECT id, status, row_counts, started_at, completed_at, error_summary FROM vaultbase.mirror_runs ORDER BY started_at DESC LIMIT 1')
  response.json(result.rows[0] ?? null)
})

app.get('/api/projects', async (_request, response) => {
  const result = await localPool.query(`SELECT id, project_ref, display_name, region, plan, enabled, backup_schedule, keep_alive_schedule, backup_mode, secret_ref, last_backup_at, measured_dump_bytes, status, created_at, updated_at FROM vaultbase.projects ORDER BY created_at DESC`)
  response.json(result.rows)
})

app.get('/api/state', async (_request, response) => {
  const [projects, activities] = await Promise.all([
    localPool.query(`SELECT id, project_ref ref, coalesce(region,'unknown') region, plan, enabled, backup_schedule, keep_alive_schedule, last_backup_at, measured_dump_bytes storage_bytes, status, secret_ref secret_path, true secret_configured FROM vaultbase.projects ORDER BY created_at DESC`),
    localPool.query(`SELECT id, project_id, snapshot_id, event_type type, status, occurred_at, duration_ms, bytes, message FROM vaultbase.activities ORDER BY occurred_at DESC LIMIT 500`),
  ])
  response.json({ projects: projects.rows, activities: activities.rows })
})

app.put('/api/projects/:id/secrets/storage', async (request, response, next) => {
  try {
    const id = normalizeProjectId(request.params.id)
    const input = z.object({ endpoint: z.string().url().startsWith('https://'), accessKeyId: z.string().min(8).max(256), secretAccessKey: z.string().min(16).max(512) }).parse(request.body)
    const exists = await localPool.query('SELECT 1 FROM vaultbase.projects WHERE id=$1', [id])
    if (!exists.rowCount) return response.status(404).json({ error: 'Project not found.' })
    const reference = `supabase/${id}/storage-s3`
    await secretStore.put(reference, JSON.stringify(input))
    await localPool.query(`INSERT INTO vaultbase.project_secret_refs(project_id, kind, secret_ref) VALUES ($1,'storage_s3',$2) ON CONFLICT (project_id,kind) DO UPDATE SET secret_ref=excluded.secret_ref, configured_at=now()`, [id, reference])
    response.status(204).end()
  } catch (error) { if (error instanceof z.ZodError) return response.status(400).json({ error: 'Invalid Storage S3 credentials.' }); next(error) }
})

app.post('/api/projects', async (request, response, next) => {
  let secretRef: string | null = null
  let wroteSecret = false
  try {
    const input = projectInputSchema.parse(request.body)
    const id = normalizeProjectId(input.displayName)
    if (!id) return response.status(400).json({ error: 'Project name must contain letters or numbers.' })
    const parsed = parseSupabaseDatabaseUrl(input.databaseUrl)
    secretRef = `supabase/${id}/database`
    const client = await localPool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id])
      const duplicate = await client.query('SELECT 1 FROM vaultbase.projects WHERE id=$1 OR project_ref=$2', [id, parsed.projectRef])
      if (duplicate.rowCount) {
        await client.query('ROLLBACK')
        return response.status(409).json({ error: 'That project name or Supabase reference is already registered.' })
      }
      await secretStore.put(secretRef, input.databaseUrl)
      wroteSecret = true
      const result = await client.query(`INSERT INTO vaultbase.projects(id, project_ref, display_name, region, plan, backup_schedule, keep_alive_schedule, backup_mode, secret_ref)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, project_ref, display_name, region, plan, enabled, backup_schedule, keep_alive_schedule, backup_mode, secret_ref, status, created_at`,
        [id, parsed.projectRef, input.displayName, parsed.region, input.plan, input.backupSchedule, input.keepAliveSchedule, input.backupMode, secretRef])
      await client.query(`INSERT INTO vaultbase.audit_events(actor, action, target_type, target_id, metadata) VALUES ('api-token', 'project.created', 'project', $1, $2)`, [id, { connectionType: parsed.connectionType }])
      await client.query('COMMIT')
      response.status(201).json(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  } catch (error) {
    if (wroteSecret && secretRef) await secretStore.remove(secretRef).catch(() => undefined)
    if (error instanceof z.ZodError) return response.status(400).json({ error: 'Invalid project details.', issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) })
    if (error instanceof Error && (error.message.includes('connection string') || error.message.includes('Session Pooler') || error.message.includes('project reference') || error.message.includes('[YOUR-PASSWORD]'))) return response.status(400).json({ error: error.message })
    next(error)
  }
})

app.delete('/api/projects/:id', async (request, response, next) => {
  try {
    const id = normalizeProjectId(request.params.id)
    const client = await localPool.connect()
    let secretRef: string | null = null
    try {
      await client.query('BEGIN')
      const project = await client.query('SELECT secret_ref FROM vaultbase.projects WHERE id=$1 FOR UPDATE', [id])
      if (!project.rowCount) {
        await client.query('ROLLBACK')
        return response.status(404).json({ error: 'Project not found.' })
      }
      secretRef = project.rows[0].secret_ref
      await client.query('DELETE FROM vaultbase.projects WHERE id=$1', [id])
      await client.query(`INSERT INTO vaultbase.audit_events(actor, action, target_type, target_id) VALUES ('api-token', 'project.deleted', 'project', $1)`, [id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
    if (secretRef) await secretStore.remove(secretRef)
    response.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/projects/:id/backups', async (request, response, next) => {
  try {
    const result = await createRecoveryPack(normalizeProjectId(request.params.id))
    response.status(201).json({ snapshotId: result.snapshotId, resticSnapshotId: result.resticSnapshotId, bytes: result.dumpBytes, status: 'uploaded' })
  } catch (error) { next(error) }
})

app.post('/api/projects/:id/keep-alive', async (request, response, next) => {
  const id = normalizeProjectId(request.params.id)
  try { await runKeepAlive(id); response.status(204).end() } catch (error) { next(error) }
})

app.get('/api/snapshots', async (_request, response) => {
  const result = await localPool.query(`SELECT s.id, s.project_id, s.restic_snapshot_id, s.status, s.components, s.dump_bytes, s.started_at, s.completed_at, s.verified_at, s.expires_at FROM vaultbase.snapshots s ORDER BY s.started_at DESC LIMIT 500`)
  response.json(result.rows)
})

app.get('/api/snapshots/:id/download', async (request, response, next) => {
  try { await streamSnapshotDownload(request.params.id, response) } catch (error) { if (!response.headersSent) next(error) }
})

app.get('/api/activities/:id/download', async (request, response, next) => {
  try {
    const activity = await localPool.query(`SELECT snapshot_id FROM vaultbase.activities WHERE id=$1 AND event_type='backup' AND status='success'`, [request.params.id])
    if (!activity.rowCount || !activity.rows[0].snapshot_id) return response.status(404).json({ error: 'Downloadable backup not found.' })
    await streamSnapshotDownload(activity.rows[0].snapshot_id, response)
  } catch (error) { if (!response.headersSent) next(error) }
})

app.post('/api/snapshots/:id/verify', async (request, response, next) => {
  try {
    const snapshot = await localPool.query('SELECT restic_snapshot_id FROM vaultbase.snapshots WHERE id=$1', [request.params.id])
    if (!snapshot.rowCount || !snapshot.rows[0].restic_snapshot_id) return response.status(404).json({ error: 'Snapshot not found.' })
    response.json(await verifyResticSnapshot(snapshot.rows[0].restic_snapshot_id))
  } catch (error) { next(error) }
})

app.post('/api/mirror/run', async (_request, response, next) => {
  try { response.status(202).json(await syncMirror()) } catch (error) { next(error) }
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error instanceof Error ? error.message : 'Unhandled server error')
  response.status(500).json({ error: 'Internal server error' })
})

if (config.SERVE_STATIC) {
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }))
  app.get('*path', (_request, response) => response.sendFile(join(dist, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }))
}

await migrate(localPool)
app.listen(config.API_PORT, config.API_HOST, () => console.log(`Vaultbase API listening on ${config.API_HOST}:${config.API_PORT}`))
