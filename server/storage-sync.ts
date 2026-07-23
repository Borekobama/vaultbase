import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.js'
import { runProcess } from './process.js'
import { secretStore } from './secret-store.js'

export interface StorageSecret { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string }

function storageEnvironment(secret: StorageSecret) {
  const endpoint = new URL(secret.endpoint)
  if (endpoint.protocol !== 'https:') throw new Error('Storage S3 endpoint must use HTTPS.')
  return {
    ...process.env,
    RCLONE_CONFIG_SUPABASE_TYPE: 's3',
    RCLONE_CONFIG_SUPABASE_PROVIDER: 'Other',
    RCLONE_CONFIG_SUPABASE_ENDPOINT: endpoint.toString(),
    RCLONE_CONFIG_SUPABASE_REGION: secret.region || 'auto',
    RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID: secret.accessKeyId,
    RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY: secret.secretAccessKey,
    RCLONE_CONFIG_SUPABASE_NO_CHECK_BUCKET: 'true',
  }
}

export async function validateStorageCredentials(secret: StorageSecret) {
  await runProcess('rclone', ['lsd', 'supabase:'], { env: storageEnvironment(secret) })
}

export async function syncStorageObjects(projectId: string, destination: string) {
  const reference = `supabase/${projectId}/storage-s3`
  if (!(await secretStore.has(reference))) return { configured: false, objects: 0 }
  const secret = JSON.parse(await secretStore.get(reference)) as StorageSecret
  const cache = join(config.STORAGE_CACHE_DIRECTORY, projectId)
  await Promise.all([mkdir(cache, { recursive: true, mode: 0o700 }), mkdir(destination, { recursive: true, mode: 0o700 })])
  const env = storageEnvironment(secret)
  await runProcess('rclone', ['sync', 'supabase:', cache, '--fast-list', '--checkers', '8', '--transfers', '4', '--metadata', '--delete-during'], { env })
  await runProcess('rclone', ['copy', cache, destination, '--links', '--metadata'], { env })
  const listing = await runProcess('rclone', ['lsjson', cache, '--recursive', '--files-only', '--hash'], { env })
  const objects = JSON.parse(listing.stdout) as unknown[]
  await writeFile(join(destination, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), objectCount: objects.length, objects }, null, 2)}\n`, { mode: 0o600 })
  return { configured: true, objects: objects.length }
}
