import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BackupSnapshot, Project } from '../domain'
import { ProjectTable } from './ProjectTable'

const pendingProject: Project = {
  id: 'priority-project',
  displayName: 'Priority Project',
  ownerEmail: 'owner@example.com',
  environment: 'production',
  notes: 'Customer-facing production application.',
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
  storageSecretConfigured: false,
  managementSecretConfigured: false,
  latestRecoveryPoint: null,
  restoreDrills: [],
}

const tableActions = {
  downloadingId: null,
  showBackupArchive: false,
  onRunBackup: vi.fn(),
  onRunKeepAlive: vi.fn(),
  onVerifyRecoveryPoint: vi.fn(),
  onListBackups: vi.fn().mockResolvedValue([]),
  onDownloadBackup: vi.fn(),
  onUpdate: vi.fn(),
  onRefresh: vi.fn(),
  onAdd: vi.fn(),
}

describe('ProjectTable', () => {
  it('explains first-backup state and exposes useful recovery details', () => {
    render(<ProjectTable projects={[pendingProject]} activities={[]} busyJob={null} {...tableActions}/>)

    expect(screen.getByText('Priority Project')).toBeInTheDocument()
    expect(screen.queryByText('Customer-facing production application.')).not.toBeInTheDocument()
    expect(screen.getByText('Awaiting backup')).toBeInTheDocument()
    expect(screen.queryByText('Not completed yet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText('Customer-facing production application.')).toBeInTheDocument()
    expect(screen.getByText('Not completed yet')).toBeInTheDocument()
    expect(screen.getByText('0 successful')).toBeInTheDocument()
    expect(screen.getByText('0 failed · 0 total attempts')).toBeInTheDocument()
    expect(screen.getByText('Not measured')).toBeInTheDocument()
    expect(screen.getByText('Waiting for the first recovery point')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test restore now' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Run backup for priority-project' })).toHaveTextContent('Run first backup')
  })

  it('edits project identity and protection settings inline', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<ProjectTable projects={[pendingProject]} activities={[]} busyJob={null} {...tableActions} onUpdate={onUpdate}/>)

    const view = within(container)
    fireEvent.click(view.getByRole('button', { name: 'Edit' }))
    fireEvent.change(view.getByLabelText('Display name'), { target: { value: 'Vaultbase Production' } })
    fireEvent.change(view.getByLabelText('Owner email'), { target: { value: 'backup-owner@example.com' } })
    fireEvent.change(view.getByLabelText('Environment'), { target: { value: 'staging' } })
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('priority-project', expect.objectContaining({
      displayName: 'Vaultbase Production',
      ownerEmail: 'backup-owner@example.com',
      environment: 'staging',
      backupSchedule: '0 3 * * *',
    })))
  })

  it('shows component coverage and starts a restore drill', () => {
    const onVerify = vi.fn()
    const protectedProject: Project = {
      ...pendingProject,
      status: 'healthy',
      lastBackupAt: '2026-07-23T15:09:40.935Z',
      successfulBackupCount: 1,
      snapshotCount: 1,
      latestRecoveryPoint: {
        id: 'snapshot-1',
        status: 'uploaded',
        startedAt: '2026-07-23T15:09:14.228Z',
        completedAt: '2026-07-23T15:09:40.935Z',
        verifiedAt: null,
        fileCount: 7,
        tablesVerified: null,
        filesVerified: null,
        warnings: ['Storage object bodies require Storage S3 credentials.'],
        coverage: { database: true, roles: true, auth: true, storageMetadata: true, storageObjects: false, configuration: true, managementApi: false },
      },
    }
    const { container } = render(<ProjectTable projects={[protectedProject]} activities={[]} busyJob={null} {...tableActions} onVerifyRecoveryPoint={onVerify}/>)
    const view = within(container)

    expect(view.queryByText('5 of 7 components protected')).not.toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Details' }))
    expect(view.getByText('5 of 7 components protected')).toBeInTheDocument()
    expect(view.getAllByText('Credentials needed')).toHaveLength(2)
    expect(view.getByText('Not tested yet')).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Test restore now' }))
    expect(onVerify).toHaveBeenCalledWith('priority-project')
  })

  it('lists project backups newest first and downloads an available snapshot', async () => {
    const onDownload = vi.fn()
    const snapshot = (id: string, startedAt: string, source: BackupSnapshot['triggerSource']): BackupSnapshot => ({
      id, projectId: pendingProject.id, status: 'uploaded', triggerSource: source, mode: 'full_project',
      databaseRoute: 'direct', startedAt, completedAt: startedAt, expiresAt: null, bytes: 1_024,
      fileCount: 7, coverage: { database: true, roles: true, auth: true, storageMetadata: true, storageObjects: false, configuration: true, managementApi: false },
      warnings: [], errorSummary: null, downloadable: true,
    })
    const onList = vi.fn().mockResolvedValue([
      snapshot('older', '2026-07-22T10:00:00.000Z', 'scheduled'),
      snapshot('newer', '2026-07-23T10:00:00.000Z', 'manual'),
    ])
    render(<ProjectTable projects={[{ ...pendingProject, snapshotCount: 2 }]} activities={[]} busyJob={null} {...tableActions} showBackupArchive onListBackups={onList} onDownloadBackup={onDownload}/>)

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(await screen.findByText('Backup history')).toBeInTheDocument()
    const manualTag = await screen.findByText('Manual')
    const newestEntry = manualTag.closest('article')
    expect(newestEntry).not.toBeNull()
    fireEvent.click(within(newestEntry as HTMLElement).getByRole('button', { name: /Download backup/ }))
    expect(onDownload).toHaveBeenCalledWith('newer')
  })
})
