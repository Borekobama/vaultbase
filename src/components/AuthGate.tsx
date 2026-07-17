import { FormEvent, type ReactNode, useEffect, useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'signed_out' | 'signed_in'>('checking')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void fetch('/api/session', { credentials: 'same-origin' }).then(response => setStatus(response.ok ? 'signed_in' : 'signed_out')).catch(() => { setError('Vaultbase API is unavailable.'); setStatus('signed_out') }) }, [])

  const login = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    try {
      const response = await fetch('/api/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? 'Sign-in failed.') }
      setKey(''); setStatus('signed_in')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in failed.') } finally { setBusy(false) }
  }

  if (status === 'checking') return <div className="auth-screen"><div className="loading-state" role="status"><span className="spinner"/>Connecting to Vaultbase…</div></div>
  if (status === 'signed_in') return children
  return <main className="auth-screen"><section className="auth-panel" aria-labelledby="login-title"><div className="auth-brand"><span className="brand-mark" aria-hidden="true">◒</span>vaultbase</div><div className="auth-seal"><ShieldCheck size={20}/><span>Private control plane</span></div><h1 id="login-title">Unlock your backup vault</h1><p>Your key is exchanged for an HttpOnly session and is never stored by the browser.</p><form onSubmit={login}><label htmlFor="vaultbase-key">Vaultbase key</label><div className="auth-input"><KeyRound size={16}/><input id="vaultbase-key" type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="current-password" required autoFocus/></div>{error && <div className="field-error" role="alert">{error}</div>}<button className="primary wide" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock Vaultbase'}</button></form></section></main>
}
