import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Project } from '../domain'
import { ProjectTable } from './ProjectTable'

const pendingProject: Project = {
  id: 'priority-project',
  ref: 'abcdefghijklmnopqrst',
  region: 'eu-west-1',
  plan: 'free',
  enabled: true,
  backupMode: 'full_project',
  backupSchedule: '0 3 * * *',
  keepAliveSchedule: '0 9 */3 * *',
  createdAt: '2026-07-23T12:00:00.000Z',
  nextBackupAt: '2026-07-24T01:00:00.000Z',
  lastBackupAt: null,
  latestBackupAttemptAt: null,
  storageBytes: 0,
  snapshotCount: 0,
  successfulBackupCount: 0,
  failedBackupCount: 0,
  status: 'pending',
  secretPath: 'supabase/priority-project/database',
  secretConfigured: true,
}

describe('ProjectTable', () => {
  it('explains first-backup state and exposes useful recovery details', () => {
    render(<ProjectTable projects={[pendingProject]} activities={[]} busyJob={null} onRunBackup={vi.fn()} onRunKeepAlive={vi.fn()} onRefresh={vi.fn()} onAdd={vi.fn()}/>)

    expect(screen.getByText('Awaiting backup')).toBeInTheDocument()
    expect(screen.getByText('Not completed yet')).toBeInTheDocument()
    expect(screen.getByText('0 successful')).toBeInTheDocument()
    expect(screen.getByText('0 failed · 0 total attempts')).toBeInTheDocument()
    expect(screen.getByText('Not measured')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run backup for priority-project' })).toHaveTextContent('Run first backup')
  })
})
