import { createMirrorPool, localPool } from './db.js'

async function main() {
  const mirror = createMirrorPool()
  const localClient = await localPool.connect()
  const mirrorClient = await mirror.connect()
  try {
    const query = `SELECT jsonb_object_agg(name, jsonb_build_object('rows', row_count, 'hash', content_hash)) AS fingerprint FROM (
      SELECT 'projects' name, count(*)::int row_count, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) content_hash FROM vaultbase.projects t
      UNION ALL SELECT 'project_secret_refs', count(*)::int, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) FROM vaultbase.project_secret_refs t
      UNION ALL SELECT 'snapshots', count(*)::int, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) FROM vaultbase.snapshots t
      UNION ALL SELECT 'activities', count(*)::int, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) FROM vaultbase.activities t
      UNION ALL SELECT 'audit_events', count(*)::int, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) FROM vaultbase.audit_events t
      UNION ALL SELECT 'settings', count(*)::int, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) FROM vaultbase.settings t
    ) fingerprints`
    await Promise.all([localClient.query(`SET TIME ZONE 'UTC'`), mirrorClient.query(`SET TIME ZONE 'UTC'`)])
    const [local, remote] = await Promise.all([localClient.query(query), mirrorClient.query(query)])
    const matches = JSON.stringify(local.rows[0].fingerprint) === JSON.stringify(remote.rows[0].fingerprint)
    console.log(JSON.stringify({ matches, local: local.rows[0].fingerprint, mirror: remote.rows[0].fingerprint }))
    if (!matches) process.exitCode = 1
  } finally {
    localClient.release()
    mirrorClient.release()
    await Promise.all([localPool.end(), mirror.end()])
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
