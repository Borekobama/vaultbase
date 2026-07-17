import { Activity, Database, Play, RotateCw } from 'lucide-react'
import type { Project } from '../domain'
import { formatBytes, formatDateTime } from '../lib/format'

interface ProjectTableProps {
  projects: Project[]
  busyJob: string | null
  onRunBackup: (projectId: string) => void
  onRunKeepAlive: (projectId: string) => void
  onRefresh: () => void
  onAdd: () => void
}

const statusLabel: Record<Project['status'], string> = { healthy: 'Healthy', warning: 'Review', pending: 'Pending', running: 'Running', failed: 'Failed' }

export function ProjectTable({ projects, busyJob, onRunBackup, onRunKeepAlive, onRefresh, onAdd }: ProjectTableProps) {
  return <section className="panel" aria-labelledby="projects-title">
    <div className="panel-heading"><div><h2 id="projects-title">Projects</h2><p>Connected Supabase projects and protection status</p></div><button className="quiet button-with-icon" type="button" onClick={onRefresh}><RotateCw size={14} aria-hidden="true"/>Refresh</button></div>
    {projects.length === 0 ? <div className="empty-state"><Database size={24} aria-hidden="true"/><h3>No projects connected</h3><p>Add a Supabase project to schedule encrypted backups and keep-alive checks.</p><button className="primary" type="button" onClick={onAdd}>Add project</button></div> : <>
      <div className="table-wrap"><table><thead><tr><th scope="col">Project</th><th scope="col">Protection</th><th scope="col">Last backup</th><th scope="col">Storage</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {projects.map(project => { const backupRunning = busyJob === `backup:${project.id}` || project.status === 'running'; const keepAliveRunning = busyJob === `keep_alive:${project.id}`; return <tr key={project.id}>
          <td data-label="Project"><div className="project-cell"><div className={`project-logo ${project.status}`} aria-hidden="true">⌁</div><div className="project-identity"><div className="identity-title"><strong title={project.id}>{project.id}</strong><span className={`plan-badge ${project.plan}`}>{project.plan}</span></div><small title={`${project.ref} · ${project.region}`}>{project.ref} · {project.region}</small></div></div></td>
          <td data-label="Protection"><div className="protection"><span><b className="dot blue-dot" aria-hidden="true"/>Backup <strong>{project.backupSchedule}</strong></span><span><b className="dot amber-dot" aria-hidden="true"/>Keep alive <strong>{project.keepAliveSchedule}</strong></span></div></td>
          <td data-label="Last backup"><time className="last-backup" dateTime={project.lastBackupAt ?? undefined}>{formatDateTime(project.lastBackupAt)}</time></td><td data-label="Storage">{formatBytes(project.storageBytes)}</td>
          <td data-label="Status"><span className={`status ${project.status}`}><b aria-hidden="true"/>{statusLabel[project.status]}</span></td>
          <td data-label="Actions"><div className="row-actions"><button className="quiet action-button" type="button" disabled={Boolean(busyJob) || !project.enabled} aria-label={`Run keep-alive for ${project.id}`} onClick={() => onRunKeepAlive(project.id)}><Activity size={13} aria-hidden="true"/>{keepAliveRunning ? 'Checking…' : 'Ping'}</button><button className="quiet action-button" type="button" disabled={Boolean(busyJob) || !project.enabled} aria-label={`Run backup for ${project.id}`} onClick={() => onRunBackup(project.id)}><Play size={13} aria-hidden="true"/>{backupRunning ? 'Running…' : 'Backup'}</button></div></td>
        </tr>})}
      </tbody></table></div>
      <div className="table-footer"><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span><span>Runner: <strong>home-nas-01</strong> <i aria-hidden="true"/></span></div>
    </>}
  </section>
}
