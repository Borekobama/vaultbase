import { createRecoveryPack } from './recovery-pack.js'
import { localPool } from './db.js'
import { secretStore } from './secret-store.js'

const id = 'vaultbase-integration-test'
const reference = `supabase/${id}/database`

async function main() {
  await localPool.query(`INSERT INTO vaultbase.projects(id, project_ref, display_name, region, plan, backup_mode, secret_ref)
    VALUES ($1,'localintegration','Vaultbase integration test','local','free','database',$2) ON CONFLICT (id) DO NOTHING`, [id, reference])
  await secretStore.put(reference, 'postgresql://berke@localhost:5432/vaultbase')
  const retain = process.argv.includes('--retain')
  try {
    const result = await createRecoveryPack(id)
    console.log(JSON.stringify({ uploaded: true, resticSnapshotId: result.resticSnapshotId, bytes: result.dumpBytes, fileCount: result.manifest.files.length }))
  } finally {
    if (!retain) {
      await localPool.query('DELETE FROM vaultbase.projects WHERE id=$1', [id])
      await localPool.query('DELETE FROM vaultbase.activities WHERE project_id IS NULL AND message=$1', ['Recovery pack uploaded'])
      await secretStore.remove(reference)
    }
    await localPool.end()
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
