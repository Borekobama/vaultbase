import { cloneElement, FormEvent, ReactElement, useEffect, useRef, useState } from 'react'
import { ChevronDown, KeyRound, ShieldCheck, X } from 'lucide-react'
import type { NewProjectInput } from '../domain'
import { normalizeProjectId, type FieldErrors, validateProject } from '../lib/validation'
import { BackupRoleSqlTemplate } from './BackupRoleSqlTemplate'

const initialInput: NewProjectInput = { name: '', plan: 'free', backupMode: 'database', databaseUrl: '', backupSchedule: 'Daily', keepAliveSchedule: 'Every 3 days' }

interface AddProjectDialogProps {
  open: boolean
  existingIds: string[]
  onClose: () => void
  onSubmit: (input: NewProjectInput) => Promise<void>
}

export function AddProjectDialog({ open, existingIds, onClose, onSubmit }: AddProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState(initialInput)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [connectionRoute, setConnectionRoute] = useState<'session' | 'direct'>('session')
  const projectId = normalizeProjectId(input.name) || 'project-name'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) {
      setInput(initialInput)
      setErrors({})
      setSetupOpen(false)
      setConnectionRoute('session')
    }
  }, [open])

  const update = (field: keyof NewProjectInput, value: string) => {
    setInput(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors = validateProject(input, existingIds)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSubmitting(true)
    try {
      await onSubmit(input)
      setInput(initialInput)
      setErrors({})
      onClose()
    } catch (reason) {
      setErrors(current => ({ ...current, databaseUrl: reason instanceof Error ? reason.message : 'Could not add this project.' }))
    } finally {
      setSubmitting(false)
    }
  }

  return <dialog ref={dialogRef} className="modal setup-modal" aria-labelledby="add-project-title" onClose={onClose} onCancel={onClose}>
    <form onSubmit={submit} noValidate>
      <button type="button" className="modal-close icon-control" aria-label="Close add project dialog" onClick={onClose}><X size={17}/></button>
      <div className="eyebrow">NEW CONNECTION</div><h2 id="add-project-title">Add a project</h2>
      <p>Project reference and region are derived automatically. The connection string is sent once to the encrypted server-side secret store.</p>
      <Field label="Project name" error={errors.name}><input name="name" value={input.name} onChange={event => update('name', event.target.value)} required maxLength={80} autoComplete="off" placeholder="customer-portal" aria-invalid={Boolean(errors.name)}/></Field>
      <Field label="Supabase plan"><select name="plan" value={input.plan} onChange={event => update('plan', event.target.value)}><option value="free">Free · 5 GB egress / month</option><option value="pro">Pro · 250 GB egress / month</option><option value="team">Team · 250 GB egress / month</option></select></Field>
      <Field label="Protection mode"><select name="backupMode" value={input.backupMode} onChange={event => update('backupMode', event.target.value)}><option value="database">Database · roles, schema and data</option><option value="full_project">Full project · database, Auth, Storage and configuration</option></select></Field>
      <section className="role-setup" aria-labelledby="role-setup-title">
        <button className="role-setup-toggle" type="button" aria-expanded={setupOpen} aria-controls="role-setup-instructions" onClick={() => setSetupOpen(current => !current)}><span className="role-step">1</span><div><strong id="role-setup-title">Create the backup role</strong><small>Run one rerunnable SQL statement in this project</small></div><ChevronDown className={setupOpen ? 'rotated' : ''} size={15} aria-hidden="true"/></button>
        {setupOpen && <div className="role-setup-body" id="role-setup-instructions"><div className="role-safety"><ShieldCheck size={15}/><p>Replace the password placeholder, then run this in the backup project’s SQL Editor. It grants global read access and RLS bypass for complete exports, but no write role.</p></div><BackupRoleSqlTemplate/></div>}
      </section>
      <div className="connection-step"><span className="role-step">2</span><div><strong>Choose one connection route</strong><small>Both routes reach the same database; Vaultbase needs only one.</small></div></div>
      <div className="connection-routes" role="group" aria-label="Database connection route"><button type="button" className={connectionRoute === 'session' ? 'selected' : ''} aria-pressed={connectionRoute === 'session'} onClick={() => setConnectionRoute('session')}><strong>Session pooler</strong><small>Recommended · IPv4 · port 5432</small></button><button type="button" className={connectionRoute === 'direct' ? 'selected' : ''} aria-pressed={connectionRoute === 'direct'} onClick={() => setConnectionRoute('direct')}><strong>Direct</strong><small>Native pg_dump · IPv6 · port 5432</small></button></div>
      <Field label={`${connectionRoute === 'session' ? 'Session pooler' : 'Direct'} connection string`} error={errors.databaseUrl}><input name="databaseUrl" value={input.databaseUrl} onChange={event => update('databaseUrl', event.target.value)} type="password" required autoComplete="new-password" spellCheck={false} placeholder={connectionRoute === 'session' ? 'postgresql://vaultbase_backup.PROJECT_REF:ENCODED_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres' : 'postgresql://vaultbase_backup:ENCODED_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres'} aria-invalid={Boolean(errors.databaseUrl)}/></Field>
      <p className="connection-help">{connectionRoute === 'session' ? <>In Supabase, click Connect → Session pooler. Replace <code>postgres</code> with <code>vaultbase_backup</code>, keep <code>.PROJECT_REF</code>, and use the backup-role password.</> : <>In Supabase, click Connect → Direct connection. Replace <code>postgres</code> with <code>vaultbase_backup</code> and use the backup-role password. This route requires IPv6 or Supabase’s IPv4 add-on.</>}</p>
      <div className="form-grid"><Field label="Backup schedule"><select name="backupSchedule" value={input.backupSchedule} onChange={event => update('backupSchedule', event.target.value)}><option>Every 6 hours</option><option>Daily</option><option>Weekly</option></select></Field><Field label="Keep-alive"><select name="keepAliveSchedule" value={input.keepAliveSchedule} onChange={event => update('keepAliveSchedule', event.target.value)}><option>Every day</option><option>Every 3 days</option><option>Every 5 days</option></select></Field></div>
      <div className="secret-note"><KeyRound size={15} aria-hidden="true"/><span>Encrypted secret: <code>supabase/{projectId}/database</code></span></div>
      <button className="primary wide" type="submit" disabled={submitting}>{submitting ? 'Validating…' : 'Add project'}</button>
    </form>
  </dialog>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement<Record<string, unknown>> }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return <label className="field" htmlFor={id}><span>{label}</span>{/* clone ensures a deterministic label/input association */}
    {cloneElement(children, { id, 'aria-describedby': error ? `${id}-error` : undefined })}
    {error && <small id={`${id}-error`} className="field-error" role="alert">{error}</small>}
  </label>
}
