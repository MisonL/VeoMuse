import path from 'path'

export interface GateStep {
  name: string
  command: string
  commandArgs?: string[]
  env?: Record<string, string>
  retries?: number
  qualityTags?: string[]
  outputCheck?: GateStepOutputCheck
}

export type SloMode = 'soft' | 'hard'
export type SloBootstrapStatus = 'reused' | 'started' | 'skipped'
export type ReleaseGateStatus = 'passed' | 'failed'
export type ReleaseGateStepStatus = 'passed' | 'failed'
export type ReleaseGateStepAttemptStatus = 'passed' | 'failed'
export type QualitySloBootstrapStatus = SloBootstrapStatus | 'not-needed' | 'failed'
export type VideoGenerateLoopStatus = 'not-run' | 'passed' | 'failed'
export type RealE2EStatus = 'not-run' | 'passed' | 'failed'
export type ClassifiedFailureType = 'auth' | 'quota' | 'timeout' | 'upstream_5xx' | 'unknown'
export type VideoGenerateLoopFailureType = ClassifiedFailureType
export type RealE2EFailureType = ClassifiedFailureType
export type FailureDomain = 'security' | 'build' | 'test' | 'e2e' | 'slo' | 'unknown'
export type GateStepOutputCheck = 'require_real_e2e_executed'

export interface SloBootstrapResult {
  status: SloBootstrapStatus
  detail: string
  process?: Bun.Subprocess
}

export interface StepAttemptResult {
  attempt: number
  startedAtMs: number
  endedAtMs: number
  durationMs: number
  status: ReleaseGateStepAttemptStatus
  exitCode: number | null
  failureMessage?: string
}

export interface QualitySummaryStepAttempt {
  attempt: number
  startedAt: string
  endedAt: string
  durationMs: number
  status: ReleaseGateStepAttemptStatus
  exitCode: number | null
  failureMessage?: string
}

export interface QualitySummaryStep {
  name: string
  command: string
  startedAt: string
  endedAt: string
  durationMs: number
  status: ReleaseGateStepStatus
  attempts: QualitySummaryStepAttempt[]
  failure?: {
    message: string
    exitCode: number | null
    domain: FailureDomain
  }
}

export interface QualitySummaryVideoGenerateLoop {
  trackedStepName: string
  status: VideoGenerateLoopStatus
  attempts: number
  detail: string
  failureType?: VideoGenerateLoopFailureType | null
  startedAt?: string
  endedAt?: string
}

export interface QualitySummaryRealE2E {
  trackedStepName: string
  status: RealE2EStatus
  attempts: number
  detail: string
  failureType?: RealE2EFailureType | null
  startedAt?: string
  endedAt?: string
}

export interface QualitySummary {
  schemaVersion: string
  generatedAt: string
  status: ReleaseGateStatus
  branch: string
  ci: boolean
  sloMode: SloMode
  sloApiBase: string
  runRealE2E: boolean
  sloBootstrap: {
    enabled: boolean
    status: QualitySloBootstrapStatus
    detail: string
    startedAt?: string
    endedAt?: string
    stopExitCode?: number | null
  }
  videoGenerateLoop: QualitySummaryVideoGenerateLoop
  realE2E: QualitySummaryRealE2E
  steps: QualitySummaryStep[]
  recommendations: string[]
  failure?: {
    message: string
  }
}

export const DEFAULT_SLO_API_BASE = 'http://127.0.0.1:33117'
export const DEFAULT_SLO_BOOTSTRAP_TIMEOUT_MS = 15_000
export const DEFAULT_SLO_HEALTH_TIMEOUT_MS = 1_200
export const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1'])
export const QUALITY_SUMMARY_RELATIVE_PATH = path.join('artifacts', 'quality-summary.json')
export const QUALITY_TAG_VIDEO_GENERATE_LOOP = 'video_generate_loop'
export const QUALITY_TAG_REAL_E2E = 'real_e2e'
export const VIDEO_GENERATE_LOOP_DEFAULT_STEP_NAME = 'E2E Regression'
export const REAL_E2E_STEP_NAME = 'E2E Regression (Real)'
export const REAL_E2E_PRECHECK_STEP_NAME = 'E2E Regression (Real) Precheck'
export const REAL_E2E_PRECHECK_COMMAND = 'validate real-e2e required env'
