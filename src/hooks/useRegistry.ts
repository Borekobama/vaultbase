import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewProjectInput, RegistryState } from '../domain'
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

  return {
    ...state,
    loading,
    error,
    clearError: () => setError(null),
    addProject: (input: NewProjectInput) => run(() => registryService.addProject(input)),
    runBackup: (projectId: string) => run(() => registryService.runBackup(projectId)),
    runKeepAlive: (projectId: string) => run(() => registryService.runKeepAlive(projectId)),
    downloadBackup: (activityId: string) => registryService.downloadBackup(activityId),
    reset: () => run(() => registryService.reset()),
  }
}
