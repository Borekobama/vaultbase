import { createRecoveryPack } from './recovery-pack.js'
import { localPool } from './db.js'

const projectId = process.argv[2]
if (!projectId) { console.error('Usage: npm run backup:project -- <project-id>'); process.exit(2) }

createRecoveryPack(projectId)
  .then(result => console.log(`Backup uploaded: snapshot ${result.snapshotId}, ${result.dumpBytes} bytes.`))
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
  .finally(() => localPool.end())
