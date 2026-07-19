import { CheckCircle2, Download, Gauge, KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { ActivityItem, Project } from '../domain'
import { formatBytes, formatDateTime, formatDuration } from '../lib/format'
import { BACKUP_BUDGET_RATIO, PLAN_EGRESS_GB, recommendBackupFrequency } from '../lib/planner'

export function ActivityPage({ activities, downloadingId, onDownload }: { activities: ActivityItem[]; downloadingId: string | null; onDownload: (activityId: string) => void }) {
  return <section className="activity-page" aria-labelledby="activity-title">
    <div className="activity-summary"><CheckCircle2 size={24} aria-hidden="true"/><div><strong>Recovery activity</strong><p>Latest backup, keep-alive, and retention events</p></div></div>
    <div className="panel activity-panel"><div className="panel-heading"><div><h2 id="activity-title">Recent activity</h2><p>Recovery job events</p></div><span className="badge">Latest 500</span></div>
      {activities.length === 0 ? <div className="empty-state compact"><h3>No activity yet</h3><p>Runner events will appear here after the first job.</p></div> : activities.map(item => <div className="activity-row" key={item.id}><span className={`activity-icon ${item.status === 'failed' || item.status === 'warning' || item.type === 'keep_alive' ? 'amber' : ''}`} aria-hidden="true">{item.status === 'failed' ? '!' : item.type === 'keep_alive' ? '⌁' : item.type === 'retention' ? '↻' : '✓'}</span><div className="activity-copy"><strong>{item.message}</strong><small>{item.projectId} · <time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time></small></div><span className="activity-value">{item.bytes ? formatBytes(item.bytes) : formatDuration(item.durationMs)}</span>{item.type === 'backup' && item.status === 'success' && <button className="quiet action-button" type="button" disabled={Boolean(downloadingId)} onClick={() => onDownload(item.id)} aria-label={`Download backup for ${item.projectId} from ${formatDateTime(item.occurredAt)}`}><Download size={13}/>{downloadingId === item.id ? 'Preparing…' : 'Download'}</button>}</div>)}
    </div>
  </section>
}

export function PlannerPage({ projects }: { projects: Project[] }) {
  return <section className="planner-stack" aria-labelledby="planner-title">
    <div className="planner-explainer"><Gauge size={21} aria-hidden="true"/><div><strong>Measured-size recommendations</strong><p>Vaultbase reserves {(1 - BACKUP_BUDGET_RATIO) * 100}% of included Supabase egress for your application. Paid quotas are organization-wide, so combine sibling projects when planning.</p></div></div>
    <div className="panel"><div className="panel-heading"><div><h2 id="planner-title">Backup planner</h2><p>Current Supabase quotas: Free {PLAN_EGRESS_GB.free} GB; Pro and Team {PLAN_EGRESS_GB.pro} GB per organization/month.</p></div></div>
      {projects.length === 0 ? <div className="empty-state compact"><h3>No projects to calculate</h3><p>Add a project and run its first backup to measure the exported dump.</p></div> : <div className="planner-list">{projects.map(project => { const result = recommendBackupFrequency(project.plan, project.storageBytes); return <article className="planner-row" key={project.id}><div className="planner-project"><strong>{project.id}</strong><span className={`plan-badge ${project.plan}`}>{project.plan}</span><small>Measured dump: {formatBytes(project.storageBytes)}</small></div><div className="planner-result"><small>Recommended</small><strong>{result.label}</strong><span>{result.measured ? `${formatBytes(result.projectedMonthlyEgressBytes)} of ${formatBytes(result.backupBudgetBytes)} backup budget/month` : result.warning}</span></div><div className="planner-result"><small>R2 worst-case</small><strong>{result.measured ? formatBytes(result.projectedR2Bytes) : '—'}</strong><span>7-day retention before measured deduplication</span></div>{result.warning && result.measured && <div className="planner-warning"><TriangleAlert size={15}/>{result.warning}</div>}</article>})}</div>}
    </div>
  </section>
}

export function SecretsPage({ projects }: { projects: Project[] }) {
  return <section className="panel narrow-panel" aria-labelledby="secrets-title"><div className="panel-heading"><div><h2 id="secrets-title">Secret references</h2><p>Values are never displayed or persisted by the browser.</p></div><ShieldCheck size={18} aria-hidden="true"/></div>
    {projects.length === 0 ? <div className="empty-state compact"><KeyRound size={24}/><h3>No secret references</h3><p>Add a project to create its database secret path.</p></div> : <div className="secret-list">{projects.map(project => <div className="secret-row" key={project.id}><div className="secret-key"><KeyRound size={15} aria-hidden="true"/><div><code>{project.secretPath}</code><small>{project.id}</small></div></div><span className={`status ${project.secretConfigured ? 'healthy' : 'failed'}`}><b aria-hidden="true"/>{project.secretConfigured ? 'Configured' : 'Missing'}</span></div>)}</div>}
  </section>
}

export function SettingsPage() {
  return <section className="settings-stack" aria-labelledby="settings-title"><div className="panel narrow-panel"><div className="panel-heading"><div><h2 id="settings-title">Runtime</h2><p>Local-first recovery control plane.</p></div><span className="status"><b/>Connected</span></div><div className="settings-content"><dl><div><dt>Runner</dt><dd>Docker · PostgreSQL 17 tooling</dd></div><div><dt>Primary metadata</dt><dd>Local PostgreSQL · immediate transactions</dd></div><div><dt>Recovery mirror</dt><dd>Supabase PostgreSQL · scheduled atomic sync</dd></div><div><dt>Secret provider</dt><dd>AES-256-GCM local store · never mirrored</dd></div><div><dt>Backup destination</dt><dd>Cloudflare R2 · encrypted Restic repository</dd></div><div><dt>Retention</dt><dd>GFS policy · managed by the scheduler</dd></div></dl><div className="warning-callout"><TriangleAlert size={17}/><p>Keep the Restic password and Vaultbase master key in an independent password manager. Neither can be recovered from R2.</p></div></div></div>
  </section>
}
