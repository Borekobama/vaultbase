import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const seedProjects = [
  { id: 'customer-portal', ref: 'abcdefghijkl', region: 'eu-central-1', enabled: true, backup: 'Daily', keepAlive: 'Every 3 days', lastBackup: 'Today, 08:14', size: '284 MB', status: 'healthy', secret: 'supabase/customer-portal/database' },
  { id: 'internal-tools', ref: 'mnopqrstuv', region: 'eu-west-1', enabled: true, backup: 'Every 6 hours', keepAlive: 'Every 3 days', lastBackup: 'Today, 06:17', size: '96 MB', status: 'healthy', secret: 'supabase/internal-tools/database' },
  { id: 'marketing-site', ref: 'wxyz123456', region: 'us-east-1', enabled: true, backup: 'Weekly', keepAlive: 'Every 5 days', lastBackup: 'Yesterday, 22:01', size: '41 MB', status: 'warning', secret: 'supabase/marketing-site/database' },
];

const Icon = ({ name, size = 18 }) => {
  const paths = { grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', database: 'M4 6c0-2 4-3 8-3s8 1 8 3-4 3-8 3-8-1-8-3zm0 0v6c0 2 4 3 8 3s8-1 8-3V6m-16 6v6c0 2 4 3 8 3s8-1 8-3v-6', key: 'M15 7a5 5 0 1 0-4.9 6H13v3h3v-3h2v-3h-3.1A5 5 0 0 0 15 7z', activity: 'M3 12h4l2-8 4 16 2-8h6', settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3l-.5.2a1.7 1.7 0 0 0-1 1.5V20h-2.6v-.2a1.7 1.7 0 0 0-1-1.5l-.5-.2a1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9l-.2-.5a1.7 1.7 0 0 0-1.5-1H5v-2.6h.2a1.7 1.7 0 0 0 1.5-1l.2-.5a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3l.5-.2a1.7 1.7 0 0 0 1-1.5V4h2.6v.2a1.7 1.7 0 0 0 1 1.5l.5.2a1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9l.2.5a1.7 1.7 0 0 0 1.5 1h.2v2.6h-.2a1.7 1.7 0 0 0-1.5 1z' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.grid}/></svg>;
};

function App() {
  const [projects, setProjects] = useState(seedProjects);
  const [view, setView] = useState('Overview');
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const healthy = projects.filter(p => p.status === 'healthy').length;
  const totalSize = useMemo(() => projects.reduce((sum, p) => sum + parseInt(p.size), 0), [projects]);

  const notify = (message) => { setToast(message); setTimeout(() => setToast(''), 2800); };
  const runNow = (project) => { notify(`Backup queued for ${project.id}`); setProjects(ps => ps.map(p => p.id === project.id ? { ...p, lastBackup: 'Just now' } : p)); };
  const addProject = (event) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const name = f.get('name').trim().toLowerCase().replace(/\s+/g, '-');
    setProjects(ps => [{ id: name, ref: 'new-project', region: f.get('region'), enabled: true, backup: 'Daily', keepAlive: 'Every 3 days', lastBackup: 'Pending', size: '—', status: 'pending', secret: `supabase/${name}/database` }, ...ps]);
    setModal(false); notify(`${name} added to your project registry`);
  };

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">◒</span><span>vaultbase</span><span className="beta">BETA</span></div>
      <div className="workspace-label">WORKSPACE</div><button className="workspace"><span className="workspace-avatar">B</span><span className="truncate">Borek's workspace</span><span className="chevron">⌄</span></button>
      <nav>{[['Overview','grid'],['Projects','database'],['Secrets','key'],['Activity','activity']].map(([label, icon]) => <button key={label} className={view === label ? 'nav-item active' : 'nav-item'} onClick={() => setView(label)}><Icon name={icon}/><span>{label}</span>{label === 'Activity' && <span className="nav-count">3</span>}</button>)}</nav>
      <div className="sidebar-spacer"/><div className="runner-card"><div className="runner-head"><span className="pulse"/>Runner online</div><div className="runner-name">home-nas-01</div><div className="runner-meta">Last seen 12 sec ago</div></div>
      <button className="nav-item"><Icon name="settings"/><span>Settings</span></button><div className="profile"><div className="profile-avatar">BK</div><div><strong>Berke K.</strong><small>Personal</small></div><span className="more">•••</span></div>
    </aside>
    <main className="main"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{view}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧<i/></button><button className="help">?</button></div></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow">{view === 'Overview' ? 'BACKUP CONTROL PLANE' : 'WORKSPACE'}</div><h1>{view === 'Overview' ? 'Good morning, Berke' : view}</h1><p>{view === 'Overview' ? 'Your projects are protected and your runner is on standby.' : `Manage your ${view.toLowerCase()} across the workspace.`}</p></div><button className="primary" onClick={() => setModal(true)}><span>＋</span> Add project</button></div>
      {view === 'Overview' && <><section className="metrics"><div className="metric"><div className="metric-top"><span>Protected projects</span><span className="metric-icon green"><Icon name="database" size={16}/></span></div><strong>{projects.length}</strong><small><em>↑ {healthy} healthy</em> · {projects.length - healthy} need attention</small></div><div className="metric"><div className="metric-top"><span>Last 24h backups</span><span className="metric-icon blue"><Icon name="activity" size={16}/></span></div><strong>28</strong><small><em>100% success rate</em></small></div><div className="metric"><div className="metric-top"><span>Encrypted storage</span><span className="metric-icon violet">◈</span></div><strong>{totalSize} <small>MB</small></strong><small>Cloudflare R2 · 7 day retention</small></div></section><section className="notice"><div className="notice-icon">✦</div><div><strong>Keep-alive is doing its job</strong><p>All enabled projects have recorded activity within the last 3 days.</p></div><button onClick={() => setView('Activity')}>View activity <span>→</span></button></section></>}
      {view === 'Projects' || view === 'Overview' ? <section className="panel"><div className="panel-heading"><div><h2>Projects</h2><p>Connected Supabase projects and protection status</p></div><button className="quiet" onClick={() => notify('Registry refreshed')}>Refresh <span>↻</span></button></div><div className="table-wrap"><table><thead><tr><th>PROJECT</th><th>PROTECTION</th><th>LAST BACKUP</th><th>STORAGE</th><th>STATUS</th><th/></tr></thead><tbody>{projects.map(p => <tr key={p.id}><td><div className="project-cell"><div className={`project-logo ${p.status}`}>⌁</div><div><strong>{p.id}</strong><small>{p.ref} · {p.region}</small></div></div></td><td><div className="protection"><span><b className="dot blue-dot"/>Backup <strong>{p.backup}</strong></span><span><b className="dot amber-dot"/>Keep alive <strong>{p.keepAlive}</strong></span></div></td><td><span className="last-backup">{p.lastBackup}</span></td><td>{p.size}</td><td><span className={`status ${p.status}`}><b/> {p.status === 'healthy' ? 'Healthy' : p.status === 'warning' ? 'Review' : 'Pending'}</span></td><td><button className="row-menu" onClick={() => runNow(p)}>•••</button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing {projects.length} projects</span><span>Runner: <strong>home-nas-01</strong> <i className="green-dot"/></span></div></section> : <Activity view={view} projects={projects}/>}</div>
    </main>{modal && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModal(false)}><form className="modal" onSubmit={addProject}><button type="button" className="modal-close" onClick={() => setModal(false)}>×</button><div className="eyebrow">NEW CONNECTION</div><h2>Add a project</h2><p>Credentials are stored encrypted and resolved only when a runner job starts.</p><label>Project name<input name="name" required placeholder="e.g. customer-portal" autoFocus/></label><label>Region<select name="region" defaultValue="eu-central-1"><option>eu-central-1</option><option>eu-west-1</option><option>us-east-1</option></select></label><label>Database connection string<input type="password" required placeholder="postgresql://…"/></label><div className="secret-note"><Icon name="key" size={16}/> Stored as <code>supabase/<span>project-name</span>/database</code></div><button className="primary wide">Add project <span>→</span></button></form></div>}{toast && <div className="toast"><span>✓</span>{toast}</div>}</div>;
}

function Activity({ view }) { return <section className="activity-page"><div className="activity-summary"><div className="summary-mark">✓</div><div><strong>All systems operational</strong><p>Latest runner activity from the last 7 days</p></div></div><div className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Every backup and keep-alive event in one place</p></div><button className="quiet">Last 7 days⌄</button></div>{[['Backup completed','customer-portal','Today, 08:14','284 MB'],['Keep-alive query succeeded','internal-tools','Today, 07:02','42 ms'],['Backup completed','internal-tools','Today, 06:17','96 MB'],['Keep-alive query succeeded','marketing-site','Yesterday, 22:00','39 ms']].map((a,i)=><div className="activity-row" key={i}><span className={`activity-icon ${i===1||i===3?'amber':''}`}>{i===1||i===3?'⌁':'✓'}</span><div><strong>{a[0]}</strong><small>{a[1]} · {a[2]}</small></div><span className="activity-value">{a[3]}</span></div>)}</div></section> }

createRoot(document.getElementById('root')).render(<App />);
