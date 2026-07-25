import { cloneElement, FormEvent, ReactElement, useEffect, useRef, useState } from 'react'
import { ChevronDown, Cloud, KeyRound, ShieldCheck, X } from 'lucide-react'
import type { NewProjectInput, StorageCredentialsInput } from '../domain'
import { normalizeProjectId, type FieldErrors, validateProject } from '../lib/validation'
import { BackupRoleSqlTemplate } from './BackupRoleSqlTemplate'
import { DatabaseRoutesInput } from './DatabaseRoutesInput'

const initialInput: NewProjectInput = { name: '', ownerEmail: '', plan: 'free', backupMode: 'database', databaseUrl: '', directDatabaseUrl: '', backupSchedule: 'Daily', keepAliveSchedule: 'Every 3 days' }

function storageDefaults(databaseUrl: string): StorageCredentialsInput {
  try {
    const url = new URL(databaseUrl)
    const projectRef = decodeURIComponent(url.username).match(/\.([a-z0-9]+)$/i)?.[1] ?? ''
    const region = url.hostname.match(/^aws-\d+-([a-z]+-[a-z]+-\d+)\.pooler\.supabase\.com$/i)?.[1] ?? 'auto'
    return { endpoint: projectRef ? `https://${projectRef}.storage.supabase.co/storage/v1/s3` : '', region, accessKeyId: '', secretAccessKey: '' }
  } catch {
    return { endpoint: '', region: 'auto', accessKeyId: '', secretAccessKey: '' }
  }
}

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
  const [storageOpen, setStorageOpen] = useState(false)
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
      setStorageOpen(false)
    }
  }, [open])

  const update = (field: keyof NewProjectInput, value: string) => {
    setInput(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
  }

  const updateStorage = (field: keyof StorageCredentialsInput, value: string) => {
    setInput(current => ({ ...current, storageCredentials: { ...(current.storageCredentials ?? storageDefaults(current.databaseUrl)), [field]: value } }))
    setErrors(current => ({ ...current, storageCredentials: undefined }))
  }

  const toggleStorage = () => {
    setStorageOpen(current => {
      const next = !current
      setInput(value => ({ ...value, storageCredentials: next ? value.storageCredentials ?? storageDefaults(value.databaseUrl) : undefined }))
      setErrors(value => ({ ...value, storageCredentials: undefined }))
      return next
    })
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
      const message = reason instanceof Error ? reason.message : 'Could not add this project.'
      if (/storage|s3/i.test(message) && input.storageCredentials) setErrors(current => ({ ...current, storageCredentials: message }))
      else if (/owner|email/i.test(message)) setErrors(current => ({ ...current, ownerEmail: message }))
      else setErrors(current => ({ ...current, databaseUrl: message }))
    } finally {
      setSubmitting(false)
    }
  }

  return <dialog ref={dialogRef} className="modal setup-modal" aria-labelledby="add-project-title" onClose={onClose} onCancel={onClose}>
    <form onSubmit={submit} noValidate>
      <button type="button" className="modal-close icon-control" aria-label="Close add project dialog" onClick={onClose}><X size={17}/></button>
      <div className="eyebrow">NEW CONNECTION</div><h2 id="add-project-title">Add a project</h2>
      <p>Build the database routes from a few Supabase details or paste the complete strings. Credentials are sent once to the encrypted server-side secret store.</p>
      <Field label="Project name" error={errors.name}><input name="name" value={input.name} onChange={event => update('name', event.target.value)} required maxLength={80} autoComplete="off" placeholder="customer-portal" aria-invalid={Boolean(errors.name)}/></Field>
      <Field label="Owner email (optional)" error={errors.ownerEmail}><input name="ownerEmail" type="email" value={input.ownerEmail} onChange={event => update('ownerEmail', event.target.value)} maxLength={254} autoComplete="email" placeholder="owner@example.com" aria-invalid={Boolean(errors.ownerEmail)}/></Field>
      <Field label="Supabase plan"><select name="plan" value={input.plan} onChange={event => update('plan', event.target.value)}><option value="free">Free · 5 GB egress / month</option><option value="pro">Pro · 250 GB egress / month</option><option value="team">Team · 250 GB egress / month</option></select></Field>
      <Field label="Protection mode"><select name="backupMode" value={input.backupMode} onChange={event => update('backupMode', event.target.value)}><option value="database">Database · roles, schema and data</option><option value="full_project">Full project · database, Auth, Storage and configuration</option></select></Field>
      <section className="role-setup" aria-labelledby="role-setup-title">
        <button className="role-setup-toggle" type="button" aria-expanded={setupOpen} aria-controls="role-setup-instructions" onClick={() => setSetupOpen(current => !current)}><span className="role-step">1</span><div><strong id="role-setup-title">Create the backup role</strong><small>Run one rerunnable SQL statement in this project</small></div><ChevronDown className={setupOpen ? 'rotated' : ''} size={15} aria-hidden="true"/></button>
        {setupOpen && <div className="role-setup-body" id="role-setup-instructions"><div className="role-safety"><ShieldCheck size={15}/><p>Replace the password placeholder, then run this in the backup project’s SQL Editor. It grants global read access and RLS bypass for complete exports, but no write role.</p></div><BackupRoleSqlTemplate/></div>}
      </section>
      <div className="connection-step"><span className="role-step">2</span><div><strong>Add database routes</strong><small>Direct is preferred for backups when reachable. Session provides the IPv4 fallback.</small></div></div>
      <DatabaseRoutesInput
        value={{ sessionUrl: input.databaseUrl, directUrl: input.directDatabaseUrl ?? '' }}
        onChange={routes => {
          setInput(current => {
            const previousDefaults = storageDefaults(current.databaseUrl)
            const generatedStorage = storageDefaults(routes.sessionUrl)
            const storageCredentials = current.storageCredentials
              ? {
                  ...current.storageCredentials,
                  endpoint: !current.storageCredentials.endpoint || current.storageCredentials.endpoint === previousDefaults.endpoint ? generatedStorage.endpoint : current.storageCredentials.endpoint,
                  region: !current.storageCredentials.region || current.storageCredentials.region === previousDefaults.region ? generatedStorage.region : current.storageCredentials.region,
                }
              : undefined
            return { ...current, databaseUrl: routes.sessionUrl, directDatabaseUrl: routes.directUrl, storageCredentials }
          })
          setErrors(current => ({ ...current, databaseUrl: undefined, directDatabaseUrl: undefined }))
        }}
        sessionError={errors.databaseUrl}
        directError={errors.directDatabaseUrl}
      />
      <section className={`role-setup storage-setup ${storageOpen ? 'open' : ''}`} aria-labelledby="storage-setup-title">
        <button className="role-setup-toggle" type="button" aria-expanded={storageOpen} aria-controls="storage-setup-fields" onClick={toggleStorage}><span className="role-step">3</span><div><strong id="storage-setup-title">Add Storage S3 credentials</strong><small>Include bucket object bodies in full-project backups</small></div><span className="optional-step">Optional</span><ChevronDown className={storageOpen ? 'rotated' : ''} size={15} aria-hidden="true"/></button>
        {storageOpen && <div className="role-setup-body storage-setup-body" id="storage-setup-fields">
          <div className="role-safety"><Cloud size={15}/><p>Create a key pair in Supabase → Storage → Configuration → S3. Vaultbase validates it by listing buckets and stores it encrypted; validation performs no writes.</p></div>
          <div className="storage-setup-grid">
            <label className="field storage-endpoint"><span>S3 endpoint</span><input type="url" required value={input.storageCredentials?.endpoint ?? ''} onChange={event => updateStorage('endpoint', event.target.value)} placeholder="https://PROJECT_REF.storage.supabase.co/storage/v1/s3" autoComplete="off"/></label>
            <label className="field"><span>Region</span><input required value={input.storageCredentials?.region ?? ''} onChange={event => updateStorage('region', event.target.value)} placeholder="eu-west-1" autoComplete="off"/></label>
            <label className="field"><span>Access key ID</span><input type="password" required value={input.storageCredentials?.accessKeyId ?? ''} onChange={event => updateStorage('accessKeyId', event.target.value)} autoComplete="new-password"/></label>
            <label className="field"><span>Secret access key</span><input type="password" required value={input.storageCredentials?.secretAccessKey ?? ''} onChange={event => updateStorage('secretAccessKey', event.target.value)} autoComplete="new-password"/></label>
          </div>
          {errors.storageCredentials && <small className="field-error" role="alert">{errors.storageCredentials}</small>}
        </div>}
      </section>
      <div className="form-grid"><Field label="Backup schedule"><select name="backupSchedule" value={input.backupSchedule} onChange={event => update('backupSchedule', event.target.value)}><option>Every 6 hours</option><option>Daily</option><option>Weekly</option></select></Field><Field label="Keep-alive"><select name="keepAliveSchedule" value={input.keepAliveSchedule} onChange={event => update('keepAliveSchedule', event.target.value)}><option>Every day</option><option>Every 3 days</option><option>Every 5 days</option></select></Field></div>
      <div className="secret-note"><KeyRound size={15} aria-hidden="true"/><span>Encrypted slots: <code>database</code>, optional <code>database-direct</code>{input.storageCredentials ? ', and ' : ''}{input.storageCredentials && <code>storage-s3</code>} under <code>supabase/{projectId}</code></span></div>
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
