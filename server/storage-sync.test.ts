import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheDirectory: '',
  runProcess: vi.fn(),
}))

vi.mock('./config', () => ({
  config: {
    get STORAGE_CACHE_DIRECTORY() { return mocks.cacheDirectory },
  },
}))

vi.mock('./process', () => ({ runProcess: mocks.runProcess }))

vi.mock('./secret-store', () => ({
  secretStore: {
    has: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(JSON.stringify({
      endpoint: 'https://example.storage.supabase.co/storage/v1/s3',
      region: 'eu-central-1',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-access-key',
    })),
  },
}))

import { syncStorageObjects } from './storage-sync'

describe('Storage object synchronization', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vaultbase-storage-sync-'))
    mocks.cacheDirectory = join(root, 'cache')
    mocks.runProcess.mockReset()
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('preserves and parses object listings larger than the stdout capture limit', async () => {
    const objects = Array.from({ length: 9_000 }, (_, index) => ({
      Path: `mailboxes/user-${index}/message.eml`,
      Size: index,
      Hashes: { sha1: `${index}`.padStart(40, '0') },
    }))
    expect(JSON.stringify(objects).length).toBeGreaterThan(1_000_000)

    mocks.runProcess.mockImplementation(async (_command, args, options = {}) => {
      if (args[0] === 'lsjson') {
        expect(options.stdoutFile).toBeTruthy()
        await writeFile(options.stdoutFile, JSON.stringify(objects))
      }
      return { stdout: '', stderr: '' }
    })

    const destination = join(root, 'recovery-pack', 'storage', 'objects')
    const result = await syncStorageObjects('purelymail', destination)
    const manifest = JSON.parse(await readFile(join(destination, 'manifest.json'), 'utf8'))

    expect(result).toEqual({ configured: true, objects: objects.length })
    expect(manifest.objectCount).toBe(objects.length)
    expect(manifest.objects.at(-1)).toEqual(objects.at(-1))
    await expect(readFile(join(destination, '..', '.storage-object-listing.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
