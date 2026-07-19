import { localPool } from './db.js'

export class JobAlreadyRunningError extends Error {
  constructor(public readonly jobName: string) {
    super(`Job ${jobName} is already running.`)
    this.name = 'JobAlreadyRunningError'
  }
}

export async function withJobLock<T>(jobName: string, operation: () => Promise<T>): Promise<T> {
  const client = await localPool.connect()
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) locked', [jobName])
    if (!lock.rows[0].locked) throw new JobAlreadyRunningError(jobName)
    try {
      return await operation()
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [jobName])
    }
  } finally {
    client.release()
  }
}
