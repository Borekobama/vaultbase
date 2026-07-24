import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { BACKUP_ROLE_SQL } from '../lib/backupRoleTemplate'

export function BackupRoleSqlTemplate() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(BACKUP_ROLE_SQL)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2_000)
  }

  return <div className="sql-template"><div className="sql-template-bar"><span>vaultbase_backup.sql</span><button className="quiet action-button" type="button" onClick={() => { void copy() }}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Copied' : 'Copy SQL'}</button></div><pre><code>{BACKUP_ROLE_SQL}</code></pre></div>
}
