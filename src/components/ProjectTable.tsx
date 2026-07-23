import { Activity, Archive, CalendarClock, Database, HardDrive, Play, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ActivityItem, Project } from '../domain'
import { formatBytes, formatDateTime } from '../lib/format'

interface ProjectTableProps {
  projects: Project[]
  activities: ActivityItem[]
  busyJob: string | null
  onRunBackup: (projectId: string) => void
  onRunKeepAlive: (projectId: string) => void
  onRefresh: () => void
  onAdd: () => void
}

const statusLabel: Record<Project['status'], string> = { healthy: 'Protected', warning: 'Review', pending: 'Awaiting backup', running: 'Backing up', failed: 'Backup failed' }
const scheduleLabel: Record<string, string> = {
  '0 */6 * * *': 'Every 6 hours',
  '0 3 * * *': 'Daily at 03:00',
  '0 3 * * 0': 'Sunday at 03:00',
}

export function ProjectTable({ projects, activities, busyJob, onRunBackup, onRunKeepAlive, onRefresh, onAdd }: ProjectTableProps) {
  return <section className="panel" aria-labelledby="projects-title">
    <div className="panel-heading"><div><h2 id="projects-title">Recovery ledger</h2><p>Backup coverage, recovery points, and the next scheduled action</p></div><button className="quiet button-with-icon" type="button" onClick={onRefresh}><RotateCw size={14} aria-hidden="true"/>Refresh</button></div>
    {projects.length === 0 ? <div className="empty-state"><Database size={24} aria-hidden="true"/><h3>No projects connected</h3><p>Add a Supabase project to schedule encrypted backups and keep-alive checks.</p><button className="primary" type="button" onClick={onAdd}>Add project</button></div> : <>
      <div className="project-ledger">
        {projects.map(project => {
          const backupRunning = busyJob === `backup:${project.id}` || project.status === 'running'
          const keepAliveRunning = busyJob === `keep_alive:${project.id}`
          const latestActivity = activities.find(item => item.projectId === project.id)
          return <article className={`project-record ${project.status}`} key={project.id}>
            <header className="project-record-header">
              <div className="project-cell"><div className={`project-logo ${project.status}`} aria-hidden="true">⌁</div><div className="project-identity"><div className="identity-title"><strong title={project.id}>{project.id}</strong><span className={`plan-badge ${project.plan}`}>{project.plan}</span></div><small title={`${project.ref} · ${project.region}`}>{project.ref} · {project.region}</small></div></div>
              <span className={`status ${project.status}`}><b aria-hidden="true"/>{statusLabel[project.status]}</span>
              <div className="row-actions"><button className="quiet action-button" type="button" disabled={Boolean(busyJob) || !project.enabled} aria-label={`Run keep-alive for ${project.id}`} onClick={() => onRunKeepAlive(project.id)}><Activity size={13} aria-hidden="true"/>{keepAliveRunning ? 'Checking…' : 'Ping'}</button><button className="primary compact-action" type="button" disabled={Boolean(busyJob) || !project.enabled} aria-label={`Run backup for ${project.id}`} onClick={() => onRunBackup(project.id)}><Play size={13} aria-hidden="true"/>{backupRunning ? 'Running…' : project.lastBackupAt ? 'Back up now' : 'Run first backup'}</button></div>
            </header>
            <div className="project-facts">
              <ProjectFact icon={<Archive size={14}/>} label="Protection" value={project.backupMode === 'full_project' ? 'Full project' : 'Database only'} detail={scheduleLabel[project.backupSchedule] ?? project.backupSchedule}/>
              <ProjectFact icon={<CalendarClock size={14}/>} label="Last successful backup" value={project.lastBackupAt ? formatDateTime(project.lastBackupAt) : 'Not completed yet'} detail={project.nextBackupAt ? `Next scheduled ${formatDateTime(project.nextBackupAt)}` : 'Run the first backup to establish coverage'}/>
              <ProjectFact icon={<Database size={14}/>} label="Recovery points" value={`${project.successfulBackupCount} successful`} detail={`${project.failedBackupCount} failed · ${project.snapshotCount} total attempts`}/>
              <ProjectFact icon={<HardDrive size={14}/>} label="Measured payload" value={project.storageBytes > 0 ? formatBytes(project.storageBytes) : 'Not measured'} detail={project.storageBytes > 0 ? 'Latest encrypted recovery pack' : 'Calculated after the first export'}/>
            </div>
            <footer className="project-record-footer">
              <span><b className="pulse" aria-hidden="true"/>Latest signal</span>
              <strong>{latestActivity?.message ?? 'Project registered; waiting for its first runner event'}</strong>
              <time dateTime={latestActivity?.occurredAt ?? project.createdAt}>{formatDateTime(latestActivity?.occurredAt ?? project.createdAt)}</time>
              <span className="keep-alive-policy">Keep alive: {project.keepAliveSchedule}</span>
            </footer>
          </article>
        })}
      </div>
      <div className="table-footer"><span>{projects.length} protected {projects.length === 1 ? 'project' : 'projects'}</span><span>Runner: <strong>Docker service</strong> <i aria-hidden="true"/></span></div>
    </>}
  </section>
}

function ProjectFact({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="project-fact"><div className="project-fact-label"><span aria-hidden="true">{icon}</span>{label}</div><strong>{value}</strong><small>{detail}</small></div>
}
