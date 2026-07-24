import { CheckCircle2, ChevronDown, Cloud, Database, Download, Gauge, Info, KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import type { ActivityItem, DatabaseCredentialsInput, Project, StorageCredentialsInput } from '../domain'
import { formatBytes, formatDateTime, formatDuration } from '../lib/format'
import { BACKUP_BUDGET_RATIO, PLAN_EGRESS_GB, recommendBackupFrequency } from '../lib/planner'
import { BackupRoleSqlTemplate } from './BackupRoleSqlTemplate'
import { DatabaseRoutesInput } from './DatabaseRoutesInput'

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
      {projects.length === 0 ? <div className="empty-state compact"><h3>No projects to calculate</h3><p>Add a project and run its first backup to measure the exported dump.</p></div> : <div className="planner-list">{projects.map(project => { const result = recommendBackupFrequency(project.plan, project.storageBytes); return <article className="planner-row" key={project.id}><div className="planner-project"><strong>{project.displayName}</strong><span className={`plan-badge ${project.plan}`}>{project.plan}</span><small>{project.environment} · Measured dump: {formatBytes(project.storageBytes)}</small></div><div className="planner-result"><small>Recommended</small><strong>{result.label}</strong><span>{result.measured ? `${formatBytes(result.projectedMonthlyEgressBytes)} of ${formatBytes(result.backupBudgetBytes)} backup budget/month` : result.warning}</span></div><div className="planner-result"><small>R2 worst-case</small><strong>{result.measured ? formatBytes(result.projectedR2Bytes) : '—'}</strong><span>7-day retention before measured deduplication</span></div>{result.warning && result.measured && <div className="planner-warning"><TriangleAlert size={15}/>{result.warning}</div>}</article>})}</div>}
    </div>
  </section>
}

type SecretKind = 'database' | 'storage' | 'management'

export function SecretsPage({ projects, onUpdateDatabase, onUpdateStorage, onUpdateManagement }: {
  projects: Project[]
  onUpdateDatabase: (projectId: string, input: DatabaseCredentialsInput) => Promise<void>
  onUpdateStorage: (projectId: string, input: StorageCredentialsInput) => Promise<void>
  onUpdateManagement: (projectId: string, accessToken: string) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ projectId: string; kind: SecretKind } | null>(null)
  return <section className="panel credentials-panel" aria-labelledby="secrets-title"><div className="panel-heading"><div><h2 id="secrets-title">Project credentials</h2><p>Rotate encrypted credentials here. Existing values are never returned to the browser.</p></div><ShieldCheck size={18} aria-hidden="true"/></div>
    <div className="credential-guidance"><ShieldCheck size={16}/><p>Credentials belong to this backup source—not Vaultbase’s mirror. Validation contacts the real Supabase service before encrypted storage. Management configuration is optional and currently uses a powerful account token.</p></div>
    {projects.length === 0 ? <div className="empty-state compact"><KeyRound size={24}/><h3>No project credentials</h3><p>Add a project to create its encrypted credential references.</p></div> : <div className="credential-projects">{projects.map(project => {
      const expanded = expandedId === project.id
      return <article className="credential-project" key={project.id}>
        <button className="credential-project-toggle" type="button" aria-expanded={expanded} aria-controls={`credentials-${project.id}`} onClick={() => { setExpandedId(expanded ? null : project.id); setEditing(null) }}><div><strong>{project.displayName}</strong><small>{project.ref} · {project.region}</small></div><span>{[project.secretConfigured, project.directDatabaseSecretConfigured, project.storageSecretConfigured, project.managementSecretConfigured].filter(Boolean).length}/4 configured <ChevronDown className={expanded ? 'rotated' : ''} size={15}/></span></button>
        {expanded && <div className="credential-rows" id={`credentials-${project.id}`}>
          <CredentialRow icon={<Database size={15}/>} title="Database routes" description={`Session default · Direct fallback ${project.directDatabaseSecretConfigured ? 'configured' : 'not configured'}`} configured={project.secretConfigured} reference={`${project.secretPath} · direct fallback: ${project.directDatabaseSecretConfigured ? 'encrypted' : 'optional'}`} onEdit={() => setEditing({ projectId: project.id, kind: 'database' })} help={<><strong>Create or rotate the backup role</strong><p>Replace the password placeholder, then run this single statement in this backup project’s Supabase SQL Editor.</p><BackupRoleSqlTemplate/><strong>Add both routes</strong><ol><li>Open this backup project in Supabase and select Connect.</li><li>Copy Session Pooler on port 5432 as the required default.</li><li>Optionally copy Direct on port 5432 as a fallback. Direct requires IPv6 or the IPv4 add-on.</li><li>Replace the default username with <code>vaultbase_backup</code>. For Session Pooler, preserve the <code>.PROJECT_REF</code> suffix.</li><li>Percent-encode special password characters before saving.</li></ol><p>Both routes reach the same database. Vaultbase tests Session first and uses Direct only if Session is unavailable.</p><p><b>Real validation:</b> Each supplied route is matched to this project, rejects the default <code>postgres</code> user, opens a TLS PostgreSQL connection, and executes <code>SELECT current_user</code>.</p></>}/>
          {editing?.projectId === project.id && editing.kind === 'database' && <DatabaseCredentialForm project={project} onCancel={() => setEditing(null)} onSave={value => onUpdateDatabase(project.id, value)}/>}
          <CredentialRow icon={<Cloud size={15}/>} title="Storage S3" description="Required for bucket object bodies. Supabase S3 keys have broad Storage access." configured={project.storageSecretConfigured} reference={`supabase/${project.id}/storage-s3`} onEdit={() => setEditing({ projectId: project.id, kind: 'storage' })} help={<><strong>Where to get it</strong><ol><li>Open this backup project in Supabase.</li><li>Go to Storage → Configuration → S3 and enable the S3 protocol.</li><li>Generate an access key and immediately copy the endpoint, region, access key ID, and secret access key.</li></ol><p><b>Real validation:</b> Vaultbase checks that the endpoint contains this project reference, then uses rclone to list the project’s buckets. It does not write during validation or backup, although the Supabase key itself has broad Storage power and bypasses RLS.</p><a href="https://supabase.com/docs/guides/storage/s3/authentication" target="_blank" rel="noreferrer">Open Supabase S3 instructions ↗</a></>}/>
          {editing?.projectId === project.id && editing.kind === 'storage' && <StorageCredentialForm project={project} onCancel={() => setEditing(null)} onSave={value => onUpdateStorage(project.id, value)}/>}
          <CredentialRow icon={<KeyRound size={15}/>} title="Management API token (optional)" description="Captures Supabase dashboard settings that are not stored in your database dump." configured={project.managementSecretConfigured} reference={`supabase/${project.id}/management-api`} onEdit={() => setEditing({ projectId: project.id, kind: 'management' })} help={<><strong>What it is</strong><p>The Management API is Supabase’s control plane: the settings behind its dashboard. Vaultbase reads Auth, Storage, Realtime, Data API, PostgreSQL, and connection-pooler configuration so a recovery pack documents how the project was configured—not only its rows.</p><strong>Where to get it</strong><ol><li>Open your Supabase account settings and select Access Tokens.</li><li>Generate a personal access token, copy it once, and paste it here.</li></ol><div className="credential-risk"><TriangleAlert size={14}/><span>A personal access token inherits your Supabase user privileges and may reach other projects. Vaultbase only sends GET requests, but the token itself is not technically read-only. Leave this optional credential unset if that risk is unacceptable; true least-privilege access requires a future Supabase OAuth integration.</span></div><p><b>Real validation:</b> Vaultbase calls all six read endpoints before storing the token. A token that cannot read the required configuration is rejected.</p><a href="https://supabase.com/docs/reference/api/introduction" target="_blank" rel="noreferrer">Open Management API documentation ↗</a></>}/>
          {editing?.projectId === project.id && editing.kind === 'management' && <ManagementCredentialForm onCancel={() => setEditing(null)} onSave={value => onUpdateManagement(project.id, value)}/>}
        </div>}
      </article>
    })}</div>}
  </section>
}

function CredentialRow({ icon, title, description, configured, reference, onEdit, help }: { icon: ReactNode; title: string; description: string; configured: boolean; reference: string; onEdit: () => void; help: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpId = `help-${reference.replace(/[^a-z0-9]+/gi, '-')}`
  return <div className="credential-block"><div className="credential-row"><span className="credential-icon" aria-hidden="true">{icon}</span><div className="credential-copy"><strong>{title}</strong><small>{description}</small><code>{reference}</code></div><span className={`status ${configured ? 'healthy' : 'failed'}`}><b aria-hidden="true"/>{configured ? 'Configured' : 'Missing'}</span><div className="credential-actions"><button className="quiet icon-help" type="button" aria-label={`Instructions for ${title}`} aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen(current => !current)}><Info size={14} aria-hidden="true"/></button><button className="quiet action-button" type="button" onClick={onEdit}>{configured ? 'Rotate' : 'Configure'}</button></div></div>{helpOpen && <div className="credential-help" id={helpId}>{help}</div>}</div>
}

function CredentialForm({ children, error, saving, onCancel, onSubmit }: { children: ReactNode; error: string | null; saving: boolean; onCancel: () => void; onSubmit: (event: FormEvent) => void }) {
  return <form className="credential-form" onSubmit={onSubmit}>{children}{error && <div className="editor-error" role="alert">{error}</div>}<div className="editor-actions"><button className="quiet" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Validating…' : 'Validate and save'}</button></div></form>
}

function useCredentialSubmit<T>(onSave: (value: T) => Promise<void>, value: T, onDone: () => void) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true); setError(null)
    try { await onSave(value); onDone() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Credential validation failed.'); setSaving(false) }
  }
  return { saving, error, submit }
}

function DatabaseCredentialForm({ project, onCancel, onSave }: { project: Project; onCancel: () => void; onSave: (value: DatabaseCredentialsInput) => Promise<void> }) {
  const [value, setValue] = useState<DatabaseCredentialsInput>({ sessionUrl: '', directUrl: '' })
  const state = useCredentialSubmit(onSave, value, onCancel)
  return <CredentialForm saving={state.saving} error={state.error} onSubmit={state.submit} onCancel={onCancel}><DatabaseRoutesInput value={{ sessionUrl: value.sessionUrl ?? '', directUrl: value.directUrl ?? '' }} onChange={setValue} fixedProjectRef={project.ref} requireSession={false}/><small className="credential-form-note">Field mode rotates both routes with one backup-role password. Switch to connection strings to update only one route and leave the other blank.</small></CredentialForm>
}

function StorageCredentialForm({ project, onCancel, onSave }: { project: Project; onCancel: () => void; onSave: (value: StorageCredentialsInput) => Promise<void> }) {
  const [value, setValue] = useState<StorageCredentialsInput>({ endpoint: `https://${project.ref}.storage.supabase.co/storage/v1/s3`, region: project.region === 'direct' ? 'auto' : project.region, accessKeyId: '', secretAccessKey: '' })
  const state = useCredentialSubmit(onSave, value, onCancel)
  return <CredentialForm saving={state.saving} error={state.error} onSubmit={state.submit} onCancel={onCancel}><div className="credential-form-grid"><label className="editor-field wide"><span>S3 endpoint</span><input type="url" required value={value.endpoint} onChange={event => setValue(current => ({ ...current, endpoint: event.target.value }))}/></label><label className="editor-field"><span>Region</span><input required value={value.region} onChange={event => setValue(current => ({ ...current, region: event.target.value }))}/></label><label className="editor-field"><span>Access key ID</span><input type="password" autoComplete="new-password" required value={value.accessKeyId} onChange={event => setValue(current => ({ ...current, accessKeyId: event.target.value }))}/></label><label className="editor-field"><span>Secret access key</span><input type="password" autoComplete="new-password" required value={value.secretAccessKey} onChange={event => setValue(current => ({ ...current, secretAccessKey: event.target.value }))}/></label></div><small className="credential-form-note">Create this pair in Supabase → Storage → Configuration → S3. Vaultbase validates it by listing buckets; it never writes during validation.</small></CredentialForm>
}

function ManagementCredentialForm({ onCancel, onSave }: { onCancel: () => void; onSave: (value: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  const state = useCredentialSubmit(onSave, value, onCancel)
  return <CredentialForm saving={state.saving} error={state.error} onSubmit={state.submit} onCancel={onCancel}><label className="editor-field"><span>Supabase personal access token</span><input type="password" autoComplete="new-password" required minLength={20} value={value} onChange={event => setValue(event.target.value)} placeholder="sbp_…"/><small>This account-level token is powerful. Vaultbase validates only GET access to the six configuration endpoints before encrypted storage.</small></label></CredentialForm>
}

export function SettingsPage() {
  return <section className="settings-stack" aria-labelledby="settings-title"><div className="panel narrow-panel"><div className="panel-heading"><div><h2 id="settings-title">Runtime</h2><p>Local-first recovery control plane.</p></div><span className="status"><b/>Connected</span></div><div className="settings-content"><dl><div><dt>Runner</dt><dd>Docker · PostgreSQL 17 tooling</dd></div><div><dt>Primary metadata</dt><dd>Local PostgreSQL · immediate transactions</dd></div><div><dt>Recovery mirror</dt><dd>Supabase PostgreSQL · scheduled atomic sync</dd></div><div><dt>Secret provider</dt><dd>AES-256-GCM local store · never mirrored</dd></div><div><dt>Backup destination</dt><dd>Cloudflare R2 · encrypted Restic repository</dd></div><div><dt>Retention</dt><dd>GFS policy · managed by the scheduler</dd></div></dl><div className="warning-callout"><TriangleAlert size={17}/><p>Keep the Restic password and Vaultbase master key in an independent password manager. Neither can be recovered from R2.</p></div></div></div>
  </section>
}
