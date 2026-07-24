import { useState } from 'react'
import { Braces, Check, Link2 } from 'lucide-react'
import { buildDatabaseRoutes, DEFAULT_POOLER_REGION, type DatabaseRouteFields, type DatabaseRouteUrls } from '../lib/databaseRoutes'

interface DatabaseRoutesInputProps {
  value: DatabaseRouteUrls
  onChange: (value: DatabaseRouteUrls) => void
  sessionError?: string
  directError?: string
  fixedProjectRef?: string
  requireSession?: boolean
}

export function DatabaseRoutesInput({
  value, onChange, sessionError, directError, fixedProjectRef, requireSession = true,
}: DatabaseRoutesInputProps) {
  const [mode, setMode] = useState<'fields' | 'strings'>('fields')
  const [fields, setFields] = useState<DatabaseRouteFields>({
    projectRef: fixedProjectRef ?? '',
    databaseUser: 'vaultbase_backup',
    password: '',
    poolerRegion: DEFAULT_POOLER_REGION,
    includeDirect: true,
  })

  const updateFields = <Key extends keyof DatabaseRouteFields>(key: Key, nextValue: DatabaseRouteFields[Key]) => {
    const next = { ...fields, [key]: nextValue, ...(fixedProjectRef ? { projectRef: fixedProjectRef } : {}) }
    setFields(next)
    onChange(buildDatabaseRoutes(next))
  }

  const selectMode = (nextMode: 'fields' | 'strings') => {
    setMode(nextMode)
    if (nextMode === 'fields') onChange(buildDatabaseRoutes({ ...fields, ...(fixedProjectRef ? { projectRef: fixedProjectRef } : {}) }))
    else onChange({ sessionUrl: '', directUrl: '' })
  }

  return <div className="database-route-input">
    <div className="input-mode-switch" role="group" aria-label="Database credential entry method">
      <button type="button" className={mode === 'fields' ? 'selected' : ''} aria-pressed={mode === 'fields'} onClick={() => selectMode('fields')}><Braces size={13}/><span>Build from fields</span></button>
      <button type="button" className={mode === 'strings' ? 'selected' : ''} aria-pressed={mode === 'strings'} onClick={() => selectMode('strings')}><Link2 size={13}/><span>Paste connection strings</span></button>
    </div>

    {mode === 'fields' ? <div className="route-builder">
      <div className="route-builder-grid">
        <label className="field"><span>Project reference</span><input value={fields.projectRef} onChange={event => updateFields('projectRef', event.target.value)} readOnly={Boolean(fixedProjectRef)} required placeholder="abcdefghijklmnopqrst" autoComplete="off"/><small>Found in Supabase → Project Settings → General.</small></label>
        <label className="field"><span>Database user</span><input value={fields.databaseUser} onChange={event => updateFields('databaseUser', event.target.value)} required placeholder="vaultbase_backup" autoComplete="username"/><small>Use the role created by the Vaultbase SQL template.</small></label>
        <label className="field route-password"><span>Backup-role password</span><input type="password" value={fields.password} onChange={event => updateFields('password', event.target.value)} required autoComplete="new-password" placeholder="Password set in the SQL template"/><small>This is not your main Supabase database password.</small></label>
        <label className="field route-region"><span>Session pooler region</span><div className="input-suffix"><input value={fields.poolerRegion} onChange={event => updateFields('poolerRegion', event.target.value)} required spellCheck={false}/><span>.pooler.supabase.com</span></div><small>Default: {DEFAULT_POOLER_REGION}. Replace it with the value shown under Supabase → Connect.</small></label>
      </div>
      <label className="direct-route-option"><input type="checkbox" checked={fields.includeDirect} onChange={event => updateFields('includeDirect', event.target.checked)}/><span><strong>Add Direct fallback</strong><small>Generated from the same project, user, and password. Requires IPv6 or Supabase’s IPv4 add-on.</small></span></label>
      <div className="generated-routes" aria-live="polite">
        <span className={value.sessionUrl ? 'ready' : ''}>{value.sessionUrl && <Check size={11}/>}Session {value.sessionUrl ? 'ready' : 'needs fields'}</span>
        <span className={value.directUrl ? 'ready' : ''}>{value.directUrl && <Check size={11}/>}Direct {fields.includeDirect ? value.directUrl ? 'ready' : 'needs fields' : 'omitted'}</span>
      </div>
      {(sessionError || directError) && <small className="field-error" role="alert">{sessionError ?? directError}</small>}
    </div> : <div className="route-string-fields">
      <label className="field"><span>Session pooler connection string</span><input type="password" value={value.sessionUrl} onChange={event => onChange({ ...value, sessionUrl: event.target.value })} required={requireSession} autoComplete="new-password" spellCheck={false} placeholder={requireSession ? 'postgresql://vaultbase_backup.PROJECT_REF:…@aws-0-REGION.pooler.supabase.com:5432/postgres' : 'Leave blank to keep the current Session credential'} aria-invalid={Boolean(sessionError)}/>{sessionError && <small className="field-error" role="alert">{sessionError}</small>}</label>
      <label className="field"><span>Direct connection string</span><input type="password" value={value.directUrl} onChange={event => onChange({ ...value, directUrl: event.target.value })} autoComplete="new-password" spellCheck={false} placeholder={requireSession ? 'postgresql://vaultbase_backup:…@db.PROJECT_REF.supabase.co:5432/postgres' : 'Leave blank to keep the current Direct fallback'} aria-invalid={Boolean(directError)}/>{directError && <small className="field-error" role="alert">{directError}</small>}</label>
    </div>}
  </div>
}
