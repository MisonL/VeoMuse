import { create } from 'zustand'
import { buildAuthHeaders, getAccessToken, resolveApiBase } from '../utils/eden'
import type { RequestErrorKind } from '../utils/requestError'

export type JourneyStep =
  | 'register_or_login'
  | 'organization_ready'
  | 'workspace_ready'
  | 'generation_triggered'
  | 'export_triggered'

export type JourneyFailedStage = 'register' | 'organization' | 'workspace' | 'generate' | 'export'

export type JourneyErrorKind = RequestErrorKind

const FIRST_SUCCESS_FLAG_KEY = 'veomuse-first-success-reported-v1'
const JOURNEY_QUEUE_STORAGE_KEY = 'veomuse-journey-report-queue-v1'
const JOURNEY_RETRY_BASE_DELAY_MS = 800
const JOURNEY_MAX_RETRIES = 3
const JOURNEY_FAILED_STAGE_SET = new Set<JourneyFailedStage>([
  'register',
  'organization',
  'workspace',
  'generate',
  'export'
])
const JOURNEY_ERROR_KIND_SET = new Set<JourneyErrorKind>([
  'network',
  'timeout',
  'auth',
  'permission',
  'quota',
  'server',
  'unknown'
])

interface JourneyMeta {
  steps: JourneyStep[]
  reason: string
  failedStage?: JourneyFailedStage
  errorKind?: JourneyErrorKind
  httpStatus?: number
}

interface JourneyPayload {
  flowType: 'first_success_path'
  source: 'frontend'
  stepCount: number
  success: boolean
  durationMs: number
  organizationId?: string
  workspaceId?: string
  sessionId: string
  idempotencyKey: string
  meta: JourneyMeta
}

interface PendingJourneyReport {
  id: string
  payload: JourneyPayload
  attempt: number
  nextAttemptAt: number
  createdAt: number
}

const createSessionId = () => `journey-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const createQueueId = () => `queue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const normalizeJourneyFailedStage = (value: unknown): JourneyFailedStage | undefined => {
  const stage = String(value || '').trim() as JourneyFailedStage
  return JOURNEY_FAILED_STAGE_SET.has(stage) ? stage : undefined
}

const normalizeJourneyErrorKind = (value: unknown): JourneyErrorKind | undefined => {
  const kind = String(value || '').trim() as JourneyErrorKind
  return JOURNEY_ERROR_KIND_SET.has(kind) ? kind : undefined
}

const normalizeHttpStatus = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  const status = Math.floor(parsed)
  if (status < 100 || status > 599) return undefined
  return status
}

const hasPersistedSuccess = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(FIRST_SUCCESS_FLAG_KEY) === '1'
}

const persistSuccess = () => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FIRST_SUCCESS_FLAG_KEY, '1')
}

const readQueueFromStorage = (): PendingJourneyReport[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(JOURNEY_QUEUE_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any) => {
        const payload = item.payload || {}
        if (!payload.sessionId || !payload.idempotencyKey) return null
        return {
          id: String(item.id || createQueueId()),
          payload: {
            flowType: 'first_success_path' as const,
            source: 'frontend' as const,
            stepCount: Math.max(1, Number(payload.stepCount || 1)),
            success: Boolean(payload.success),
            durationMs: Math.max(0, Number(payload.durationMs || 0)),
            organizationId: payload.organizationId ? String(payload.organizationId) : undefined,
            workspaceId: payload.workspaceId ? String(payload.workspaceId) : undefined,
            sessionId: String(payload.sessionId),
            idempotencyKey: String(payload.idempotencyKey),
            meta: {
              steps: Array.isArray(payload?.meta?.steps)
                ? (payload.meta.steps as JourneyStep[])
                : [],
              reason: String(payload?.meta?.reason || ''),
              failedStage: normalizeJourneyFailedStage(payload?.meta?.failedStage),
              errorKind: normalizeJourneyErrorKind(payload?.meta?.errorKind),
              httpStatus: normalizeHttpStatus(payload?.meta?.httpStatus)
            }
          },
          attempt: Math.max(0, Number(item.attempt || 0)),
          nextAttemptAt: Math.max(0, Number(item.nextAttemptAt || Date.now())),
          createdAt: Math.max(0, Number(item.createdAt || Date.now()))
        } as PendingJourneyReport
      })
      .filter(Boolean) as PendingJourneyReport[]
  } catch {
    return []
  }
}

const persistQueue = (queue: PendingJourneyReport[]) => {
  if (typeof window === 'undefined') return
  if (!queue.length) {
    window.localStorage.removeItem(JOURNEY_QUEUE_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(JOURNEY_QUEUE_STORAGE_KEY, JSON.stringify(queue))
}

const buildPayload = (params: {
  steps: JourneyStep[]
  success: boolean
  durationMs: number
  organizationId: string
  workspaceId: string
  sessionId: string
  reason?: string
  failedStage?: JourneyFailedStage
  errorKind?: JourneyErrorKind
  httpStatus?: number
}): JourneyPayload => {
  const idempotencyKey = `${params.sessionId}:${params.success ? 'success' : 'failed'}:${params.steps.length}`
  return {
    flowType: 'first_success_path',
    source: 'frontend',
    stepCount: Math.max(1, params.steps.length),
    success: params.success,
    durationMs: Math.max(0, params.durationMs),
    organizationId: params.organizationId || undefined,
    workspaceId: params.workspaceId || undefined,
    sessionId: params.sessionId,
    idempotencyKey,
    meta: {
      steps: params.steps,
      reason: params.reason || '',
      failedStage: normalizeJourneyFailedStage(params.failedStage),
      errorKind: normalizeJourneyErrorKind(params.errorKind),
      httpStatus: normalizeHttpStatus(params.httpStatus)
    }
  }
}

const sendJourneyPayload = async (payload: JourneyPayload) => {
  const response = await fetch(`${resolveApiBase()}/api/telemetry/journey`, {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  return response.ok
}

const upsertQueueItem = (queue: PendingJourneyReport[], payload: JourneyPayload) => {
  const duplicated = queue.some(
    (item) =>
      item.payload.sessionId === payload.sessionId &&
      item.payload.idempotencyKey === payload.idempotencyKey
  )
  if (duplicated) return queue
  return [
    ...queue,
    {
      id: createQueueId(),
      payload,
      attempt: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now()
    }
  ]
}

interface JourneyTelemetryState {
  steps: JourneyStep[]
  startedAt: number | null
  completed: boolean
  reporting: boolean
  flushingQueue: boolean
  pendingQueue: PendingJourneyReport[]
  sessionId: string
  organizationId: string
  workspaceId: string
  markStep: (step: JourneyStep, context?: { organizationId?: string; workspaceId?: string }) => void
  reportJourney: (
    success: boolean,
    context?: {
      reason?: string
      durationMs?: number
      failedStage?: JourneyFailedStage
      errorKind?: JourneyErrorKind
      httpStatus?: number
    }
  ) => Promise<boolean>
  flushQueue: () => Promise<void>
  resetJourney: (force?: boolean) => void
}

let queueRetryTimer: number | null = null

const clearQueueRetryTimer = () => {
  if (typeof window === 'undefined') return
  if (queueRetryTimer === null) return
  window.clearTimeout(queueRetryTimer)
  queueRetryTimer = null
}

export const useJourneyTelemetryStore = create<JourneyTelemetryState>((set, get) => {
  const scheduleQueueRetry = () => {
    if (typeof window === 'undefined') return
    clearQueueRetryTimer()
    const queue = get().pendingQueue
    if (!queue.length) return
    const nextAttemptAt = queue.reduce(
      (min, item) => Math.min(min, item.nextAttemptAt),
      Number.POSITIVE_INFINITY
    )
    const delayMs = Math.max(0, nextAttemptAt - Date.now()) + 16
    queueRetryTimer = window.setTimeout(() => {
      queueRetryTimer = null
      void get().flushQueue()
    }, delayMs)
  }

  const initialQueue = readQueueFromStorage()
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      void get().flushQueue()
    }, 0)
    window.addEventListener('online', () => {
      void get().flushQueue()
    })
  }

  return {
    steps: [],
    startedAt: null,
    completed: hasPersistedSuccess(),
    reporting: false,
    flushingQueue: false,
    pendingQueue: initialQueue,
    sessionId: createSessionId(),
    organizationId: '',
    workspaceId: '',
    markStep: (step, context) =>
      set((state) => {
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

      const now = Date.now()
      const durationMs = Math.max(
        0,
        context?.durationMs ?? (snapshot.startedAt ? now - snapshot.startedAt : 0)
      )
      const payload = buildPayload({
        steps: snapshot.steps,
        success,
        durationMs,
        organizationId: snapshot.organizationId,
        workspaceId: snapshot.workspaceId,
        sessionId: snapshot.sessionId,
        reason: context?.reason,
        failedStage: context?.failedStage,
        errorKind: context?.errorKind,
        httpStatus: context?.httpStatus
      })

      if (!getAccessToken().trim()) {
        set((state) => {
          const nextQueue = upsertQueueItem(state.pendingQueue, payload)
          persistQueue(nextQueue)
          return { pendingQueue: nextQueue }
        })
        scheduleQueueRetry()
        return false
      }

      set({ reporting: true })
      try {
        const sent = await sendJourneyPayload(payload)
        if (!sent) {
          set((state) => {
            const nextQueue = upsertQueueItem(state.pendingQueue, payload)
            persistQueue(nextQueue)
            return { pendingQueue: nextQueue }
          })
          scheduleQueueRetry()
          return false
        }

        if (success) {
          persistSuccess()
          set({ completed: true })
        }

        void get().flushQueue()
        return true
      } catch {
        set((state) => {
          const nextQueue = upsertQueueItem(state.pendingQueue, payload)
          persistQueue(nextQueue)
          return { pendingQueue: nextQueue }
        })
        scheduleQueueRetry()
        return false
      } finally {
        set({ reporting: false })
      }
    },
    flushQueue: async () => {
      const snapshot = get()
      if (snapshot.flushingQueue) return
      if (!snapshot.pendingQueue.length) return
      if (!getAccessToken().trim()) return

      set({ flushingQueue: true })
      try {
        let queue = [...get().pendingQueue]
        let changed = false

        for (const item of [...queue]) {
          if (item.nextAttemptAt > Date.now()) continue

          const sent = await sendJourneyPayload(item.payload).catch(() => false)
          if (sent) {
            queue = queue.filter((current) => current.id !== item.id)
            changed = true
            continue
          }

          const nextAttempt = item.attempt + 1
          if (nextAttempt >= JOURNEY_MAX_RETRIES) {
            queue = queue.filter((current) => current.id !== item.id)
            changed = true
            continue
          }

          const retryDelayMs = JOURNEY_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, nextAttempt - 1)
          queue = queue.map((current) => {
            if (current.id !== item.id) return current
            return {
              ...current,
              attempt: nextAttempt,
              nextAttemptAt: Date.now() + retryDelayMs
            }
          })
          changed = true
        }

        if (changed) {
          persistQueue(queue)
          set({ pendingQueue: queue })
        }
        scheduleQueueRetry()
      } finally {
        set({ flushingQueue: false })
      }
    },
    resetJourney: (force = false) =>
      set((state) => {
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
  }
})
