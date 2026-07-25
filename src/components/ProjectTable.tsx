import { Activity, Archive, CalendarClock, Check, ChevronDown, Clock3, Database, Download, FlaskConical, HardDrive, Layers3, Mail, Minus, Pencil, Play, RotateCw, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import type { ActivityItem, BackupSnapshot, Project, RecoveryCoverage, UpdateProjectInput } from '../domain'
import { formatBytes, formatDateTime } from '../lib/format'
import { BackupRoleSqlTemplate } from './BackupRoleSqlTemplate'

interface ProjectTableProps {
  projects: Project[]
  activities: ActivityItem[]
  busyJob: string | null
  downloadingId: string | null
  showBackupArchive: boolean
  onRunBackup: (projectId: string) => void
  onRunKeepAlive: (projectId: string) => void
  onVerifyRecoveryPoint: (projectId: string) => void
  onListBackups: (projectId: string) => Promise<BackupSnapshot[]>
  onDownloadBackup: (snapshotId: string) => void
  onUpdate: (projectId: string, input: UpdateProjectInput) => Promise<void>
  onRefresh: () => void
  onAdd: () => void
}

const statusLabel: Record<Project['status'], string> = { healthy: 'Protected', warning: 'Review', pending: 'Awaiting backup', running: 'Backing up', failed: 'Backup failed' }
const scheduleLabel: Record<string, string> = {
  '0 */6 * * *': 'Every 6 hours',
  '0 3 * * *': 'Daily at 03:00',
  '0 3 * * 0': 'Sunday at 03:00',
}

export function ProjectTable({ projects, activities, busyJob, downloadingId, showBackupArchive, onRunBackup, onRunKeepAlive, onVerifyRecoveryPoint, onListBackups, onDownloadBackup, onUpdate, onRefresh, onAdd }: ProjectTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  return <section className="panel" aria-labelledby="projects-title">
    <div className="panel-heading"><div><h2 id="projects-title">Recovery ledger</h2><p>Backup coverage, recovery points, and the next scheduled action</p></div><button className="quiet button-with-icon" type="button" onClick={onRefresh}><RotateCw size={14} aria-hidden="true"/>Refresh</button></div>
    {projects.length === 0 ? <div className="empty-state"><Database size={24} aria-hidden="true"/><h3>No projects connected</h3><p>Add a Supabase project to schedule encrypted backups and keep-alive checks.</p><button className="primary" type="button" onClick={onAdd}>Add project</button></div> : <>
      <div className="project-ledger">
        {projects.map(project => {
          const backupRunning = busyJob === `backup:${project.id}` || project.status === 'running'
          const keepAliveRunning = busyJob === `keep_alive:${project.id}`
          const verifyRunning = busyJob === `verify:${project.id}`
          const latestActivity = activities.find(item => item.projectId === project.id)
          const editing = editingId === project.id
          const expanded = expandedId === project.id
          return <article className={`project-record ${project.status}`} key={project.id}>
            <header className="project-record-header">
              <div className="project-cell"><div className={`project-logo ${project.status}`} aria-hidden="true">⌁</div><div className="project-identity"><div className="identity-title"><strong title={project.displayName}>{project.displayName}</strong><span className={`environment-tag ${project.environment}`}>{project.environment}</span><span className={`plan-badge ${project.plan}`}>{project.plan}</span></div></div></div>
              <span className={`status ${project.status}`}><b aria-hidden="true"/>{statusLabel[project.status]}</span>
              <div className="row-actions"><button className="quiet action-button details-action" type="button" aria-expanded={expanded} aria-controls={`details-${project.id}`} onClick={() => { setExpandedId(expanded ? null : project.id); if (expanded) setEditingId(null) }}><ChevronDown className={expanded ? 'rotated' : ''} size={14} aria-hidden="true"/>{expanded ? 'Hide' : 'Details'}</button><button className="quiet action-button edit-action" type="button" aria-expanded={editing} aria-controls={`edit-${project.id}`} onClick={() => { setExpandedId(project.id); setEditingId(editing ? null : project.id) }}>{editing ? <X size={13} aria-hidden="true"/> : <Pencil size={13} aria-hidden="true"/>}{editing ? 'Close' : 'Edit'}</button><button className="quiet action-button" type="button" disabled={Boolean(busyJob) || !project.enabled || project.plan !== 'free'} aria-label={`Run keep-alive for ${project.id}`} onClick={() => onRunKeepAlive(project.id)}><Activity size={13} aria-hidden="true"/>{keepAliveRunning ? 'Checking…' : 'Ping'}</button><button className="primary compact-action" type="button" disabled={Boolean(busyJob) || !project.enabled} aria-label={`Run backup for ${project.id}`} onClick={() => onRunBackup(project.id)}><Play size={13} aria-hidden="true"/>{backupRunning ? 'Running…' : project.lastBackupAt ? 'Back up now' : 'Run first backup'}</button></div>
            </header>
            {expanded && <div id={`details-${project.id}`} className="project-record-details">
            <div className="project-profile-summary"><div><span>Project reference</span><code>{project.ref}</code></div><div><span>Region</span><strong>{project.region}</strong></div><div className="project-profile-owner"><span>Owner</span>{project.ownerEmail ? <a href={`mailto:${project.ownerEmail}`}><Mail size={11}/>{project.ownerEmail}</a> : <strong>Not assigned</strong>}</div><div className="project-profile-note"><span>Notes</span><strong>{project.notes || 'No notes added'}</strong></div></div>
            {editing && <ProjectEditor project={project} onCancel={() => setEditingId(null)} onSave={async input => { await onUpdate(project.id, input); setEditingId(null) }}/>}
            <div className="project-facts">
              <ProjectFact icon={<Archive size={14}/>} label="Protection" value={project.backupMode === 'full_project' ? 'Full project' : 'Database only'} detail={scheduleLabel[project.backupSchedule] ?? project.backupSchedule}/>
              <ProjectFact icon={<CalendarClock size={14}/>} label="Last successful backup" value={project.lastBackupAt ? formatDateTime(project.lastBackupAt) : 'Not completed yet'} detail={project.nextBackupAt ? `Next scheduled ${formatDateTime(project.nextBackupAt)}` : 'Run the first backup to establish coverage'}/>
              <ProjectFact icon={<Database size={14}/>} label="Recovery points" value={`${project.successfulBackupCount} successful`} detail={`${project.failedBackupCount} failed · ${project.snapshotCount} total attempts`}/>
              <ProjectFact icon={<HardDrive size={14}/>} label="Measured payload" value={project.storageBytes > 0 ? formatBytes(project.storageBytes) : 'Not measured'} detail={project.storageBytes > 0 ? 'Latest encrypted recovery pack' : 'Calculated after the first export'}/>
            </div>
            <RecoveryReadiness project={project} verifying={verifyRunning} disabled={Boolean(busyJob)} onVerify={() => onVerifyRecoveryPoint(project.id)}/>
            {showBackupArchive && <BackupArchive project={project} downloadingId={downloadingId} onList={onListBackups} onDownload={onDownloadBackup}/>}
            <details className="project-setup-template">
              <summary><ShieldCheck size={14} aria-hidden="true"/><span><strong>Backup-role SQL template</strong><small>Keep this here for setup and password rotation</small></span><ChevronDown size={14} aria-hidden="true"/></summary>
              <div><p>Replace the password placeholder and run this statement in this project’s Supabase SQL Editor.</p><BackupRoleSqlTemplate/></div>
            </details>
            <footer className="project-record-footer">
              <span><b className="pulse" aria-hidden="true"/>Latest signal</span>
              <strong>{latestActivity?.message ?? 'Project registered; waiting for its first runner event'}</strong>
              <time dateTime={latestActivity?.occurredAt ?? project.createdAt}>{formatDateTime(latestActivity?.occurredAt ?? project.createdAt)}</time>
              <span className="keep-alive-policy">Keep alive: {project.keepAliveSchedule}</span>
            </footer>
            </div>}
          </article>
        })}
      </div>
      <div className="table-footer"><span>{projects.length} protected {projects.length === 1 ? 'project' : 'projects'}</span><span>Runner: <strong>Docker service</strong> <i aria-hidden="true"/></span></div>
    </>}
  </section>
}

const backupStatusLabel: Record<BackupSnapshot['status'], string> = {
  running: 'In progress',
  uploaded: 'Available',
  verified: 'Verified',
  restore_verified: 'Restore tested',
  failed: 'Failed',
  expired: 'Expired',
}

const archiveCoverageLabels: Array<{ key: keyof RecoveryCoverage; label: string }> = [
  { key: 'database', label: 'Database' },
  { key: 'roles', label: 'Roles' },
  { key: 'auth', label: 'Auth' },
  { key: 'storageMetadata', label: 'Storage catalog' },
  { key: 'storageObjects', label: 'Object files' },
  { key: 'configuration', label: 'Schema config' },
  { key: 'managementApi', label: 'Platform config' },
]

function BackupArchive({ project, downloadingId, onList, onDownload }: {
  project: Project
  downloadingId: string | null
  onList: (projectId: string) => Promise<BackupSnapshot[]>
  onDownload: (snapshotId: string) => void
}) {
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let current = true
    setLoading(true)
    void onList(project.id)
      .then(result => {
        if (!current) return
        setSnapshots([...result].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)))
        setError(null)
      })
      .catch(reason => {
        if (current) setError(reason instanceof Error ? reason.message : 'Backup history could not be loaded.')
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => { current = false }
  }, [onList, project.id, project.snapshotCount])

  const visible = showAll ? snapshots : snapshots.slice(0, 5)
  return <section className="backup-archive" aria-labelledby={`backup-archive-${project.id}`}>
    <div className="backup-archive-heading">
      <div><span>Recovery archive</span><strong id={`backup-archive-${project.id}`}>Backup history</strong><small>Newest recovery points appear first</small></div>
      <span className="archive-count">{snapshots.length || project.snapshotCount} {snapshots.length === 1 || (!snapshots.length && project.snapshotCount === 1) ? 'entry' : 'entries'}</span>
    </div>
    {loading ? <div className="archive-loading" role="status"><span className="spinner" aria-hidden="true"/>Loading encrypted recovery points…</div>
      : error ? <div className="archive-error" role="alert"><TriangleAlert size={14}/>{error}</div>
      : snapshots.length === 0 ? <div className="archive-empty"><Archive size={18}/><div><strong>No backups yet</strong><small>Run the first backup to create a downloadable recovery point.</small></div></div>
      : <div className="backup-timeline">
        {visible.map(snapshot => {
          const included = archiveCoverageLabels.filter(item => snapshot.coverage[item.key])
          const downloading = downloadingId === snapshot.id
          return <article className={`backup-entry ${snapshot.status}`} key={snapshot.id}>
            <div className="timeline-rail" aria-hidden="true"><span/></div>
            <div className="backup-entry-main">
              <div className="backup-entry-title">
                <time dateTime={snapshot.startedAt}>{formatDateTime(snapshot.startedAt)}</time>
                <span className={`source-tag ${snapshot.triggerSource}`}>{snapshot.triggerSource === 'manual' ? 'Manual' : 'Scheduled'}</span>
                <span className={`snapshot-status ${snapshot.status}`}>{backupStatusLabel[snapshot.status]}</span>
              </div>
              <div className="backup-entry-context">
                <span><Layers3 size={11}/>{snapshot.mode === 'full_project' ? 'Full project' : 'Database only'}</span>
                {snapshot.databaseRoute && <span><Database size={11}/>{snapshot.databaseRoute === 'direct' ? 'Direct route' : 'Session route'}</span>}
                <span><Clock3 size={11}/>{snapshot.fileCount} {snapshot.fileCount === 1 ? 'file' : 'files'}</span>
              </div>
              <div className="backup-components" aria-label="Included backup components">
                {included.length > 0 ? included.map(item => <span key={item.key}><Check size={9}/>{item.label}</span>) : <span className="muted">Component inventory unavailable</span>}
              </div>
              {(snapshot.errorSummary || snapshot.warnings[0]) && <p className={snapshot.errorSummary ? 'snapshot-error-copy' : 'snapshot-warning-copy'}>{snapshot.errorSummary ?? snapshot.warnings[0]}</p>}
            </div>
            <div className="backup-entry-size"><strong>{snapshot.bytes > 0 ? formatBytes(snapshot.bytes) : '—'}</strong><small>{snapshot.completedAt ? 'Backup payload' : 'Calculating'}</small></div>
            <button className="quiet action-button backup-download" type="button" disabled={!snapshot.downloadable || Boolean(downloadingId)} onClick={() => onDownload(snapshot.id)} aria-label={`Download backup from ${formatDateTime(snapshot.startedAt)}`}><Download size={13}/>{downloading ? 'Preparing…' : snapshot.downloadable ? 'Download' : backupStatusLabel[snapshot.status]}</button>
          </article>
        })}
      </div>}
    {snapshots.length > 5 && <button className="archive-more" type="button" onClick={() => setShowAll(current => !current)}>{showAll ? 'Show latest 5' : `Show all ${snapshots.length} backups`}<ChevronDown className={showAll ? 'rotated' : ''} size={13}/></button>}
  </section>
}

const coverageItems: Array<{ key: keyof RecoveryCoverage; label: string; fullProjectOnly?: boolean }> = [
  { key: 'database', label: 'Database' },
  { key: 'roles', label: 'Roles' },
  { key: 'auth', label: 'Auth users', fullProjectOnly: true },
  { key: 'storageMetadata', label: 'Storage catalog', fullProjectOnly: true },
  { key: 'storageObjects', label: 'Object files', fullProjectOnly: true },
  { key: 'configuration', label: 'Configuration', fullProjectOnly: true },
  { key: 'managementApi', label: 'Platform config', fullProjectOnly: true },
]

function RecoveryReadiness({ project, verifying, disabled, onVerify }: { project: Project; verifying: boolean; disabled: boolean; onVerify: () => void }) {
  const point = project.latestRecoveryPoint
  const required = coverageItems.filter(item => !item.fullProjectOnly || project.backupMode === 'full_project')
  const protectedCount = required.filter(item => point?.coverage[item.key]).length
  const latestDrill = project.restoreDrills[0]
  return <section className="recovery-readiness" aria-label={`Recovery readiness for ${project.displayName}`}>
    <div className="coverage-pane">
      <div className="readiness-heading"><div><span>Recovery readiness</span><strong>{point ? `${protectedCount} of ${required.length} components protected` : 'Waiting for the first recovery point'}</strong></div><div className={`readiness-score ${protectedCount === required.length && required.length > 0 ? 'complete' : 'incomplete'}`}>{protectedCount}/{required.length}</div></div>
      <div className="coverage-list">
        {coverageItems.map(item => {
          const included = !item.fullProjectOnly || project.backupMode === 'full_project'
          const covered = Boolean(point?.coverage[item.key])
          const credentialsNeeded = item.key === 'storageObjects' ? !project.storageSecretConfigured : item.key === 'managementApi' ? !project.managementSecretConfigured : false
          const detail = !included ? 'Not in mode' : covered ? 'Captured' : credentialsNeeded ? 'Credentials needed' : 'Missing'
          return <div className={`coverage-item ${!included ? 'excluded' : covered ? 'covered' : 'missing'}`} key={item.key}><span className="coverage-mark" aria-hidden="true">{!included ? <Minus size={12}/> : covered ? <Check size={12}/> : <X size={12}/>}</span><strong>{item.label}</strong><small>{detail}</small></div>
        })}
      </div>
      {point?.warnings[0] && <div className="coverage-warning"><TriangleAlert size={13} aria-hidden="true"/>{point.warnings[0]}</div>}
    </div>
    <div className="drill-pane">
      <div className="drill-heading"><span>Restore drills</span><FlaskConical size={15} aria-hidden="true"/></div>
      {latestDrill ? <div className="drill-result"><div className="drill-state"><ShieldCheck size={18} aria-hidden="true"/><div><strong>Latest drill passed</strong><time dateTime={latestDrill.verifiedAt}>{formatDateTime(latestDrill.verifiedAt)}</time></div></div><p>{latestDrill.tablesVerified === null ? 'Application data restored successfully.' : `${latestDrill.tablesVerified} ${latestDrill.tablesVerified === 1 ? 'table' : 'tables'} and ${latestDrill.filesVerified ?? point?.fileCount ?? 0} archive files verified.`}</p></div> : <div className="drill-result untested"><strong>Not tested yet</strong><p>{point ? `Latest recovery point: ${formatDateTime(point.startedAt)}.` : 'Create a recovery point before running a drill.'}</p></div>}
      {project.restoreDrills.length > 1 && <div className="drill-history">{project.restoreDrills.slice(1).map(drill => <time key={`${drill.snapshotId}-${drill.verifiedAt}`} dateTime={drill.verifiedAt}><Check size={10}/>{formatDateTime(drill.verifiedAt)}</time>)}</div>}
      <button className="quiet action-button drill-action" type="button" disabled={disabled || !point} onClick={onVerify}><FlaskConical size={13} aria-hidden="true"/>{verifying ? 'Restoring…' : latestDrill ? 'Run another drill' : 'Test restore now'}</button>
    </div>
  </section>
}

const backupSchedules = [
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 3 * * *', label: 'Daily at 03:00' },
  { value: '0 3 * * 0', label: 'Sunday at 03:00' },
]
const keepAliveSchedules = [
  { value: '0 9 * * *', label: 'Every day at 09:00' },
  { value: '0 9 */3 * *', label: 'Every 3 days at 09:00' },
  { value: '0 9 */5 * *', label: 'Every 5 days at 09:00' },
]
const scheduleAliases: Record<string, string> = { 'Every 6 hours': '0 */6 * * *', Daily: '0 3 * * *', Weekly: '0 3 * * 0', 'Every day': '0 9 * * *', 'Every 3 days': '0 9 */3 * *', 'Every 5 days': '0 9 */5 * *' }

function ProjectEditor({ project, onCancel, onSave }: { project: Project; onCancel: () => void; onSave: (input: UpdateProjectInput) => Promise<void> }) {
  const [input, setInput] = useState<UpdateProjectInput>({
    displayName: project.displayName,
    ownerEmail: project.ownerEmail ?? '',
    environment: project.environment,
    notes: project.notes,
    plan: project.plan,
    backupMode: project.backupMode,
    backupSchedule: scheduleAliases[project.backupSchedule] ?? project.backupSchedule,
    keepAliveSchedule: project.plan === 'free' ? scheduleAliases[project.keepAliveSchedule] ?? project.keepAliveSchedule : null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const update = <Key extends keyof UpdateProjectInput>(key: Key, value: UpdateProjectInput[Key]) => {
    setInput(current => ({ ...current, [key]: value }))
    setError(null)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (input.displayName.trim().length < 2) return setError('Display name must contain at least two characters.')
    if (input.ownerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.ownerEmail.trim())) return setError('Enter a valid owner email address.')
    setSaving(true)
    try { await onSave({ ...input, displayName: input.displayName.trim(), ownerEmail: input.ownerEmail.trim(), notes: input.notes.trim(), keepAliveSchedule: input.plan === 'free' ? input.keepAliveSchedule : null }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Project details could not be saved.'); setSaving(false) }
  }

  return <form className="project-editor" id={`edit-${project.id}`} onSubmit={submit}>
    <div className="editor-intro"><div><span>Project profile</span><strong>Make this connection recognizable at a glance.</strong></div><small>Reference <code>{project.ref}</code> and region <code>{project.region}</code> are connection-derived and cannot be edited.</small></div>
    <div className="editor-fields">
      <label className="editor-field editor-name"><span>Display name</span><input value={input.displayName} maxLength={80} autoFocus onChange={event => update('displayName', event.target.value)} placeholder="Customer production"/></label>
      <label className="editor-field"><span>Owner email</span><input type="email" value={input.ownerEmail} maxLength={254} onChange={event => update('ownerEmail', event.target.value)} placeholder="owner@example.com" autoComplete="email"/></label>
      <label className="editor-field"><span>Environment</span><select value={input.environment} onChange={event => update('environment', event.target.value as UpdateProjectInput['environment'])}><option value="production">Production</option><option value="staging">Staging</option><option value="development">Development</option></select></label>
      <label className="editor-field editor-notes"><span>What does it power?</span><textarea value={input.notes} maxLength={240} rows={2} onChange={event => update('notes', event.target.value)} placeholder="Customer portal, billing data, and account authentication…"/><small>{input.notes.length}/240</small></label>
      <label className="editor-field"><span>Supabase plan</span><select value={input.plan} onChange={event => { const plan = event.target.value as UpdateProjectInput['plan']; setInput(current => ({ ...current, plan, keepAliveSchedule: plan === 'free' ? current.keepAliveSchedule ?? '0 9 */3 * *' : null })) }}><option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option><option value="enterprise">Enterprise</option></select></label>
      <label className="editor-field"><span>Protection mode</span><select value={input.backupMode} onChange={event => update('backupMode', event.target.value as UpdateProjectInput['backupMode'])}><option value="database">Database only</option><option value="full_project">Full project</option></select></label>
      <label className="editor-field"><span>Backup schedule</span><select value={input.backupSchedule} onChange={event => update('backupSchedule', event.target.value)}>{backupSchedules.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="editor-field"><span>Keep-alive schedule</span><select value={input.keepAliveSchedule ?? ''} disabled={input.plan !== 'free'} onChange={event => update('keepAliveSchedule', event.target.value || null)}>{input.plan !== 'free' && <option value="">Paid plans do not need keep-alive</option>}{keepAliveSchedules.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>
    {error && <div className="editor-error" role="alert">{error}</div>}
    <div className="editor-actions"><button className="quiet" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
  </form>
}

function ProjectFact({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="project-fact"><div className="project-fact-label"><span aria-hidden="true">{icon}</span>{label}</div><strong>{value}</strong><small>{detail}</small></div>
}
