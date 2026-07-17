import { cloneElement, FormEvent, ReactElement, useEffect, useRef, useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import type { NewProjectInput } from '../domain'
import { normalizeProjectId, type FieldErrors, validateProject } from '../lib/validation'

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

  return <dialog ref={dialogRef} className="modal" aria-labelledby="add-project-title" onClose={onClose} onCancel={onClose}>
    <form onSubmit={submit} noValidate>
      <button type="button" className="modal-close icon-control" aria-label="Close add project dialog" onClick={onClose}><X size={17}/></button>
      <div className="eyebrow">NEW CONNECTION</div><h2 id="add-project-title">Add a project</h2>
      <p>Project reference and region are derived automatically. The connection string is sent once to the encrypted server-side secret store.</p>
      <Field label="Project name" error={errors.name}><input name="name" value={input.name} onChange={event => update('name', event.target.value)} required maxLength={80} autoComplete="off" placeholder="customer-portal" aria-invalid={Boolean(errors.name)}/></Field>
      <Field label="Supabase plan"><select name="plan" value={input.plan} onChange={event => update('plan', event.target.value)}><option value="free">Free · 5 GB egress / month</option><option value="pro">Pro · 250 GB egress / month</option><option value="team">Team · 250 GB egress / month</option></select></Field>
      <Field label="Protection mode"><select name="backupMode" value={input.backupMode} onChange={event => update('backupMode', event.target.value)}><option value="database">Database · roles, schema and data</option><option value="full_project">Full project · database, Auth, Storage and configuration</option></select></Field>
      <Field label="Database connection string" error={errors.databaseUrl}><input name="databaseUrl" value={input.databaseUrl} onChange={event => update('databaseUrl', event.target.value)} type="password" required autoComplete="new-password" spellCheck={false} placeholder="postgresql://postgres.ref:password@host:5432/postgres" aria-invalid={Boolean(errors.databaseUrl)}/></Field>
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
