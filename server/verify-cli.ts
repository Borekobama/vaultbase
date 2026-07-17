import { verifyResticSnapshot } from './verify-recovery.js'
import { localPool } from './db.js'

const snapshotId = process.argv[2]
if (!snapshotId) { console.error('Usage: npm run restore:verify -- <restic-snapshot-id>'); process.exit(2) }

verifyResticSnapshot(snapshotId)
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
  .finally(() => localPool.end())
