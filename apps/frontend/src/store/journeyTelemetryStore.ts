import { create } from 'zustand'
import { buildAuthHeaders, getAccessToken, resolveApiBase } from '../utils/eden'

export type JourneyStep =
  | 'register_or_login'
  | 'organization_ready'
  | 'workspace_ready'
  | 'generation_triggered'
  | 'export_triggered'

const FIRST_SUCCESS_FLAG_KEY = 'veomuse-first-success-reported-v1'

const createSessionId = () => `journey-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const hasPersistedSuccess = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(FIRST_SUCCESS_FLAG_KEY) === '1'
}

const persistSuccess = () => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FIRST_SUCCESS_FLAG_KEY, '1')
}

interface JourneyTelemetryState {
  steps: JourneyStep[]
  startedAt: number | null
  completed: boolean
  reporting: boolean
  sessionId: string
  organizationId: string
  workspaceId: string
  markStep: (step: JourneyStep, context?: { organizationId?: string; workspaceId?: string }) => void
  reportJourney: (success: boolean, context?: { reason?: string; durationMs?: number }) => Promise<boolean>
  resetJourney: (force?: boolean) => void
}

export const useJourneyTelemetryStore = create<JourneyTelemetryState>((set, get) => ({
  steps: [],
  startedAt: null,
  completed: hasPersistedSuccess(),
  reporting: false,
  sessionId: createSessionId(),
  organizationId: '',
  workspaceId: '',
  markStep: (step, context) => set((state) => {
    const nextSteps = state.steps.includes(step) ? state.steps : [...state.steps, step]
    const nextOrg = context?.organizationId?.trim() || state.organizationId
    const nextWorkspace = context?.workspaceId?.trim() || state.workspaceId
    return {
      steps: nextSteps,
      organizationId: nextOrg,
      workspaceId: nextWorkspace,
      startedAt: state.startedAt || Date.now()
    }
  }),
  reportJourney: async (success, context) => {
    const snapshot = get()
    if (!snapshot.steps.length) return false
    if (snapshot.reporting) return false
    if (success && (snapshot.completed || hasPersistedSuccess())) return false
    if (!getAccessToken().trim()) return false

    set({ reporting: true })
    try {
      const now = Date.now()
      const durationMs = Math.max(0, context?.durationMs ?? (snapshot.startedAt ? now - snapshot.startedAt : 0))
      const response = await fetch(`${resolveApiBase()}/api/telemetry/journey`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          flowType: 'first_success_path',
          source: 'frontend',
          stepCount: snapshot.steps.length,
          success,
          durationMs,
          organizationId: snapshot.organizationId || undefined,
          workspaceId: snapshot.workspaceId || undefined,
          sessionId: snapshot.sessionId,
          meta: {
            steps: snapshot.steps,
            reason: context?.reason || ''
          }
        })
      })
      if (!response.ok) {
        return false
      }
      if (success) {
        persistSuccess()
        set({ completed: true })
      }
      return true
    } catch {
      return false
    } finally {
      set({ reporting: false })
    }
  },
  resetJourney: (force = false) => set((state) => {
    if (!force && state.completed) {
      return state
    }
    return {
      steps: [],
      startedAt: null,
      reporting: false,
      completed: force ? false : state.completed,
      sessionId: createSessionId(),
      organizationId: '',
      workspaceId: ''
    }
  })
}))
