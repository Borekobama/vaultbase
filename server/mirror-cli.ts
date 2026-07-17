import { syncMirror } from './mirror.js'
import { localPool } from './db.js'

syncMirror()
  .then(result => console.log(`Mirror sync completed: ${Object.values(result.rowCounts).reduce((sum, value) => sum + value, 0)} metadata rows.`))
  .catch(error => { console.error(`Mirror sync failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1 })
  .finally(() => localPool.end())
