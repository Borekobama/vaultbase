import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Bell, Database, HardDrive, Plus, ShieldCheck, X } from 'lucide-react'
import type { NewProjectInput, StorageCredentialsInput, UpdateProjectInput, View } from './domain'
import { AddProjectDialog } from './components/AddProjectDialog'
import { ActivityPage, PlannerPage, SecretsPage, SettingsPage } from './components/Pages'
import { ProjectTable } from './components/ProjectTable'
import { Sidebar } from './components/Sidebar'
import { useRegistry } from './hooks/useRegistry'
import { formatBytes } from './lib/format'

const pageCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
  Overview: { eyebrow: 'BACKUP CONTROL PLANE', title: 'Vaultbase overview', description: 'Monitor backups, keep-alive checks, and runner health.' },
  Projects: { eyebrow: 'WORKSPACE', title: 'Projects', description: 'Configure protection for connected Supabase projects.' },
  Planner: { eyebrow: 'COST CONTROL', title: 'Backup planner', description: 'Balance recovery frequency against Supabase egress and R2 storage.' },
  Secrets: { eyebrow: 'WORKSPACE', title: 'Secrets', description: 'Review encrypted secret references without exposing values.' },
  Activity: { eyebrow: 'WORKSPACE', title: 'Activity', description: 'Inspect recent backup and keep-alive runner events.' },
  Settings: { eyebrow: 'WORKSPACE', title: 'Settings', description: 'Review the current runtime and recovery configuration.' },
}

export default function App() {
  const registry = useRegistry()
  const [view, setView] = useState<View>('Overview')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busyJob, setBusyJob] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const copy = pageCopy[view]
  const healthy = registry.projects.filter(project => project.status === 'healthy').length
  const storageBytes = useMemo(() => registry.projects.reduce((sum, project) => sum + project.storageBytes, 0), [registry.projects])
  const recentBackups = registry.activities.filter(item => item.type === 'backup' && Date.now() - new Date(item.occurredAt).getTime() < 86_400_000)
  const backupDetail = recentBackups.length === 0 ? 'No backups in this window' : recentBackups.every(item => item.status === 'success') ? 'All completed successfully' : 'Some jobs need attention'

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  const notify = (message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }

  const addProject = async (input: NewProjectInput) => {
    await registry.addProject(input)
    notify(`${input.name.trim()} is now protected by Vaultbase.`)
  }

  const runBackup = async (projectId: string) => {
    if (busyJob) return
    setBusyJob(`backup:${projectId}`)
    notify(`Backup started for ${projectId}.`)
    try {
      await registry.runBackup(projectId)
      notify(`Backup completed for ${projectId}.`)
    } catch {
      // The hook exposes a recoverable error banner with the specific message.
    } finally {
      setBusyJob(null)
    }
  }

  const runKeepAlive = async (projectId: string) => {
    if (busyJob) return
    setBusyJob(`keep_alive:${projectId}`)
    notify(`Keep-alive check started for ${projectId}.`)
    try {
      await registry.runKeepAlive(projectId)
      notify(`Keep-alive check succeeded for ${projectId}.`)
    } catch {
      // The hook exposes a recoverable error banner with the specific message.
    } finally {
      setBusyJob(null)
    }
  }

  const verifyRecoveryPoint = async (projectId: string) => {
    if (busyJob) return
    setBusyJob(`verify:${projectId}`)
    notify(`Restore drill started for ${projectId}.`)
    try {
      await registry.verifyRecoveryPoint(projectId)
      notify(`Restore drill passed for ${projectId}.`)
    } catch {
      // The registry hook exposes the verification failure in the error banner.
    } finally {
      setBusyJob(null)
    }
  }

  const updateProject = async (projectId: string, input: UpdateProjectInput) => {
    await registry.updateProject(projectId, input)
    notify(`${input.displayName} was updated.`)
  }

  const refresh = async () => {
    try {
      await registry.refresh()
      notify('Registry refreshed.')
    } catch {
      // The registry hook exposes the request failure in the error banner.
    }
  }

  const downloadBackup = async (activityId: string) => {
    if (downloadingId) return
    setDownloadingId(activityId)
    try {
      const download = await registry.downloadBackup(activityId)
      const url = URL.createObjectURL(download.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = download.filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      notify('Backup bundle downloaded.')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'The backup could not be downloaded.')
    } finally {
      setDownloadingId(null)
    }
  }

  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Sidebar view={view} activityCount={registry.activities.length} onNavigate={setView}/>
    <main className="main" id="main-content" tabIndex={-1}>
      <header className="topbar"><div className="breadcrumbs" aria-label="Breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{view}</strong></div><div className="top-actions"><span className="environment-badge">Production</span><button className="icon-control" type="button" aria-label="View activity" onClick={() => setView('Activity')}><Bell size={17}/></button></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">{copy.eyebrow}</div><h1>{copy.title}</h1><p>{copy.description}</p></div>{view !== 'Settings' && <button className="primary" type="button" onClick={() => setDialogOpen(true)}><Plus size={15} aria-hidden="true"/>Add project</button>}</div>
        {registry.error && <div className="error-banner" role="alert"><span>{registry.error}</span><button type="button" className="icon-control" aria-label="Dismiss error" onClick={registry.clearError}><X size={16}/></button></div>}
        {registry.loading ? <LoadingState/> : <>
          {view === 'Overview' && <><section className="metrics" aria-label="Workspace summary"><Metric label="Protected projects" value={String(registry.projects.length)} detail={`${healthy} healthy · ${registry.projects.length - healthy} need attention`} icon={<Database size={15}/>}/><Metric label="Backups in last 24 hours" value={String(recentBackups.length)} detail={backupDetail} icon={<Activity size={15}/>}/><Metric label="Encrypted storage" value={formatBytes(storageBytes)} detail="Cloudflare R2 · GFS retention" icon={<HardDrive size={15}/>}/></section><section className="notice"><ShieldCheck size={19} aria-hidden="true"/><div><strong>Recovery infrastructure connected</strong><p>Backups are encrypted before upload and catalogued in local PostgreSQL.</p></div><button type="button" onClick={() => setView('Activity')}>View activity →</button></section></>}
          {(view === 'Overview' || view === 'Projects') && (
            <ProjectTable projects={registry.projects} activities={registry.activities} busyJob={busyJob} onRunBackup={runBackup} onRunKeepAlive={runKeepAlive} onVerifyRecoveryPoint={verifyRecoveryPoint} onUpdate={updateProject} onRefresh={() => { void refresh() }} onAdd={() => setDialogOpen(true)}/>
          )}
          {view === 'Planner' && <PlannerPage projects={registry.projects}/>} {view === 'Secrets' && <SecretsPage projects={registry.projects} onUpdateDatabase={async (id, value) => { await registry.updateDatabaseSecret(id, value); notify('Database credential verified and rotated.') }} onUpdateStorage={async (id, value: StorageCredentialsInput) => { await registry.updateStorageSecret(id, value); notify('Storage S3 credentials verified and saved.') }} onUpdateManagement={async (id, value) => { await registry.updateManagementSecret(id, value); notify('Management API token verified and saved.') }}/>} {view === 'Activity' && <ActivityPage activities={registry.activities} downloadingId={downloadingId} onDownload={downloadBackup}/>} {view === 'Settings' && <SettingsPage/>}
        </>}
      </div>
    </main>
    <AddProjectDialog open={dialogOpen} existingIds={registry.projects.map(project => project.id)} onClose={() => setDialogOpen(false)} onSubmit={addProject}/>
    <div className="toast-region" aria-live="polite" aria-atomic="true">{toast && <div className="toast"><span aria-hidden="true">✓</span>{toast}</div>}</div>
  </div>
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><span className="metric-icon green" aria-hidden="true">{icon}</span></div><strong>{value}</strong><small>{detail}</small></div>
}

function LoadingState() {
  return <div className="loading-state" role="status" aria-live="polite"><span className="spinner" aria-hidden="true"/><span>Loading your project registry…</span></div>
}
