import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { config } from './config.js'

interface Envelope { version: 1; algorithm: 'aes-256-gcm'; iv: string; tag: string; ciphertext: string }

function key() {
  if (!config.VAULTBASE_MASTER_KEY) throw new Error('VAULTBASE_MASTER_KEY is not configured.')
  return Buffer.from(config.VAULTBASE_MASTER_KEY, 'hex')
}

function pathFor(reference: string) {
  if (!/^supabase\/[a-z0-9-]+\/(database|storage-s3|management-api)$/.test(reference)) throw new Error('Invalid secret reference.')
  return join(config.SECRETS_DIRECTORY, `${reference.replaceAll('/', '__')}.enc.json`)
}

export const secretStore = {
  async put(reference: string, value: string) {
    const destination = pathFor(reference)
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key(), iv)
    cipher.setAAD(Buffer.from(reference))
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const envelope: Envelope = { version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    const temporary = `${destination}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(envelope)}\n`, { mode: 0o600 })
    await rename(temporary, destination)
  },

  async get(reference: string) {
    const envelope = JSON.parse(await readFile(pathFor(reference), 'utf8')) as Envelope
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(envelope.iv, 'base64'))
    decipher.setAAD(Buffer.from(reference))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8')
  },

  async remove(reference: string) {
    await rm(pathFor(reference), { force: true })
  },

  async has(reference: string) {
    try { await readFile(pathFor(reference)); return true } catch { return false }
  },
}
