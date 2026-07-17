import { readFile } from 'node:fs/promises'
import { config } from './config.js'
import { runProcess } from './process.js'

async function resticEnvironment() {
  const values: NodeJS.ProcessEnv = {}
  for (const line of (await readFile(config.R2_ENV_FILE, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return { ...process.env, ...values, RESTIC_PASSWORD_FILE: config.RESTIC_PASSWORD_FILE }
}

export async function applyRetention(projectId?: string, prune = false) {
  if (projectId && !/^[a-z0-9-]{1,63}$/.test(projectId)) throw new Error('Invalid project identifier.')
  const args = ['forget', '--keep-hourly', '24', '--keep-daily', '7', '--keep-weekly', '4', '--keep-monthly', '12', '--keep-tag', 'protected', '--group-by', 'tags']
  if (projectId) args.push('--tag', `project:${projectId}`)
  if (prune) args.push('--prune')
  return runProcess('restic', args, { env: await resticEnvironment() })
}
