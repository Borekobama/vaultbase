import { beforeEach, describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { registryService } from './registry'

const project = { name: 'Test Project', plan: 'free' as const, backupMode: 'database' as const, databaseUrl: 'postgresql://postgres.abcdefgh1234:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres', backupSchedule: 'Daily', keepAliveSchedule: 'Every 3 days' }

describe('registry service', () => {
  beforeEach(() => localStorage.clear())

  it('persists metadata but never the database connection string', async () => {
    const state = await registryService.addProject(project)
    expect(state.projects[0].id).toBe('test-project')
    expect(localStorage.getItem('vaultbase.mock.registry.v2')).not.toContain(project.databaseUrl)
    expect(localStorage.getItem('vaultbase.mock.registry.v2')).not.toContain('password')
  })

  it('rejects duplicate project ids', async () => {
    await registryService.addProject(project)
    await expect(registryService.addProject(project)).rejects.toThrow(/already exists/i)
  })

  it('records completed backups', async () => {
    await registryService.addProject(project)
    const state = await registryService.runBackup('test-project')
    expect(state.projects[0].status).toBe('healthy')
    expect(state.projects[0].lastBackupAt).toBeTruthy()
    expect(state.activities[0]).toMatchObject({ projectId: 'test-project', type: 'backup', status: 'success' })
  })

  it('builds a private download bundle only for a successful backup', async () => {
    await registryService.addProject(project)
    const state = await registryService.runBackup('test-project')
    const download = await registryService.downloadBackup(state.activities[0].id)
    const files = unzipSync(new Uint8Array(await download.blob.arrayBuffer()))

    expect(download.filename).toMatch(/^vaultbase-test-project-.*-mock\.zip$/)
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['manifest.json', 'roles.sql', 'schema.sql', 'data.sql']))
    expect(JSON.parse(strFromU8(files['manifest.json']))).toMatchObject({ mock: true, projectId: 'test-project' })
  })

  it('records successful keep-alive checks', async () => {
    await registryService.addProject(project)
    const state = await registryService.runKeepAlive('test-project')
    expect(state.activities[0]).toMatchObject({ projectId: 'test-project', type: 'keep_alive', status: 'success' })
  })
})
