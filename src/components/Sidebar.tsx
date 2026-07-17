import { Activity, Calculator, Database, Grid2X2, KeyRound, Settings } from 'lucide-react'
import type { View } from '../domain'

const items: Array<{ label: View; icon: typeof Grid2X2 }> = [
  { label: 'Overview', icon: Grid2X2 },
  { label: 'Projects', icon: Database },
  { label: 'Planner', icon: Calculator },
  { label: 'Secrets', icon: KeyRound },
  { label: 'Activity', icon: Activity },
]

interface SidebarProps {
  view: View
  activityCount: number
  onNavigate: (view: View) => void
}

export function Sidebar({ view, activityCount, onNavigate }: SidebarProps) {
  return <aside className="sidebar" aria-label="Workspace navigation">
    <div className="brand"><span className="brand-mark" aria-hidden="true">◒</span><span>vaultbase</span><span className="beta">PRIVATE</span></div>
    <div className="workspace-label">WORKSPACE</div>
    <button className="workspace" type="button" aria-label="Current workspace: Borek's workspace">
      <span className="workspace-avatar" aria-hidden="true">B</span><span className="truncate">Borek&apos;s workspace</span><span className="chevron" aria-hidden="true">⌄</span>
    </button>
    <nav aria-label="Primary">
      {items.map(({ label, icon: Icon }) => <button key={label} type="button" className={view === label ? 'nav-item active' : 'nav-item'} aria-current={view === label ? 'page' : undefined} aria-label={label} onClick={() => onNavigate(label)}>
        <Icon size={17} aria-hidden="true"/><span>{label}</span>{label === 'Activity' && <span className="nav-count" aria-label={`${activityCount} recent events`}>{activityCount}</span>}
      </button>)}
    </nav>
    <div className="sidebar-spacer"/>
    <div className="runner-card" aria-label="Runner status: online">
      <div className="runner-head"><span className="pulse" aria-hidden="true"/>Runner online</div>
      <div className="runner-name">vaultbase-runner</div><div className="runner-meta">Encrypted R2 target</div>
    </div>
    <button type="button" className={view === 'Settings' ? 'nav-item active' : 'nav-item'} aria-current={view === 'Settings' ? 'page' : undefined} aria-label="Settings" onClick={() => onNavigate('Settings')}><Settings size={17} aria-hidden="true"/><span>Settings</span></button>
    <div className="profile"><div className="profile-avatar" aria-hidden="true">BK</div><div><strong>Berke K.</strong><small>Private workspace</small></div></div>
  </aside>
}
