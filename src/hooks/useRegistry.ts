import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewProjectInput, RegistryState, StorageCredentialsInput, UpdateProjectInput } from '../domain'
import { registryService } from '../services/registry'

const initialState: RegistryState = { projects: [], activities: [] }

export function useRegistry() {
  const [state, setState] = useState<RegistryState>(initialState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    void registryService.load().then(data => {
      if (mounted.current) setState(data)
    }).catch(() => {
      if (mounted.current) setError('The local project registry could not be loaded.')
    }).finally(() => {
      if (mounted.current) setLoading(false)
    })
    return () => { mounted.current = false }
  }, [])

  const run = useCallback(async (operation: () => Promise<RegistryState>) => {
    setError(null)
    try {
      const next = await operation()
      if (mounted.current) setState(next)
      return next
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Something went wrong. Try again.'
      if (mounted.current) setError(message)
      throw reason
    }
  }, [])

  const refresh = useCallback(() => run(() => registryService.load()), [run])

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh().catch(() => undefined) }, 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return {
    ...state,
    loading,
    error,
    clearError: () => setError(null),
    refresh,
    addProject: (input: NewProjectInput) => run(() => registryService.addProject(input)),
    updateProject: (projectId: string, input: UpdateProjectInput) => run(() => registryService.updateProject(projectId, input)),
    updateDatabaseSecret: (projectId: string, databaseUrl: string) => run(() => registryService.updateDatabaseSecret(projectId, databaseUrl)),
    updateStorageSecret: (projectId: string, input: StorageCredentialsInput) => run(() => registryService.updateStorageSecret(projectId, input)),
    updateManagementSecret: (projectId: string, accessToken: string) => run(() => registryService.updateManagementSecret(projectId, accessToken)),
    runBackup: (projectId: string) => run(() => registryService.runBackup(projectId)),
    runKeepAlive: (projectId: string) => run(() => registryService.runKeepAlive(projectId)),
    verifyRecoveryPoint: (projectId: string) => run(() => registryService.verifyRecoveryPoint(projectId)),
    downloadBackup: (activityId: string) => registryService.downloadBackup(activityId),
    reset: () => run(() => registryService.reset()),
  }
}
