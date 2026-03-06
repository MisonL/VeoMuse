import {
  DOMAIN_RECOMMENDATIONS,
  FAILURE_DOMAIN_RULES,
  QUALITY_TAG_REAL_E2E,
  QUALITY_TAG_VIDEO_GENERATE_LOOP,
  REAL_E2E_PRECHECK_STEP_NAME,
  REAL_E2E_STEP_NAME,
  VIDEO_GENERATE_LOOP_DEFAULT_STEP_NAME
} from './summaryConstants'
import type {
  FailureDomain,
  GateStep,
  QualitySummary,
  QualitySummaryStep,
  QualitySummaryStepAttempt,
  RealE2EFailureType,
  ReleaseGateStatus,
  ReleaseGateStepStatus,
  SloMode,
  StepAttemptResult,
  VideoGenerateLoopFailureType
} from './contracts'

const toIsoString = (timestampMs: number) => new Date(timestampMs).toISOString()

const uniquePush = (items: string[], item: string) => {
  if (!item || items.includes(item)) return
  items.push(item)
}

const hasQualityTag = (step: Pick<GateStep, 'qualityTags'>, tag: string) => {
  return Array.isArray(step.qualityTags) && step.qualityTags.includes(tag)
}

const classifyFailureType = (detail: string): VideoGenerateLoopFailureType | RealE2EFailureType => {
  const text = String(detail || '').toLowerCase()
  if (!text) return 'unknown'
  if (
    text.includes('401') ||
    text.includes('403') ||
    text.includes('unauthorized') ||
    text.includes('forbidden') ||
    text.includes('invalid token') ||
    text.includes('api key') ||
    text.includes('credential')
  ) {
    return 'auth'
  }
  if (
    text.includes('429') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('resource exhausted')
  ) {
    return 'quota'
  }
  if (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('etimedout') ||
    text.includes('deadline exceeded')
  ) {
    return 'timeout'
  }
  if (
    /\b5\d\d\b/.test(text) ||
    text.includes('bad gateway') ||
    text.includes('service unavailable') ||
    text.includes('upstream')
  ) {
    return 'upstream_5xx'
  }
  return 'unknown'
}

export const resolveFailureDomain = (step: Pick<GateStep, 'name' | 'command'>): FailureDomain => {
  const source = `${step.name} ${step.command}`.toLowerCase()
  for (const rule of FAILURE_DOMAIN_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(source))) {
      return rule.domain
    }
  }
  return 'unknown'
}

export const classifyVideoGenerateLoopFailure = (detail: string): VideoGenerateLoopFailureType =>
  classifyFailureType(detail)

export const classifyRealE2EFailure = (detail: string): RealE2EFailureType =>
  classifyFailureType(detail)

export const createQualitySummary = (params: {
  branch: string
  ci: boolean
  sloMode: SloMode
  sloApiBase: string
  runRealE2E: boolean
  sloBootstrapEnabled: boolean
  generatedAt?: string
}): QualitySummary => ({
  schemaVersion: '1.0',
  generatedAt: params.generatedAt || new Date().toISOString(),
  status: 'passed',
  branch: params.branch,
  ci: params.ci,
  sloMode: params.sloMode,
  sloApiBase: params.sloApiBase,
  runRealE2E: params.runRealE2E,
  sloBootstrap: {
    enabled: params.sloBootstrapEnabled,
    status: 'not-needed',
    detail: 'not-run'
  },
  videoGenerateLoop: {
    trackedStepName: VIDEO_GENERATE_LOOP_DEFAULT_STEP_NAME,
    status: 'not-run',
    attempts: 0,
    detail: 'not-run',
    failureType: null
  },
  realE2E: {
    trackedStepName: REAL_E2E_STEP_NAME,
    status: 'not-run',
    attempts: 0,
    detail: 'not-run',
    failureType: null
  },
  steps: [],
  recommendations: []
})

export const buildQualitySummaryStep = (params: {
  step: Pick<GateStep, 'name' | 'command'>
  status: ReleaseGateStepStatus
  startedAtMs: number
  endedAtMs: number
  attempts: StepAttemptResult[]
  failureMessage?: string
  failureExitCode?: number | null
}): QualitySummaryStep => {
  const attempts: QualitySummaryStepAttempt[] = params.attempts.map((attempt) => ({
    attempt: attempt.attempt,
    startedAt: toIsoString(attempt.startedAtMs),
    endedAt: toIsoString(attempt.endedAtMs),
    durationMs: attempt.durationMs,
    status: attempt.status,
    exitCode: attempt.exitCode,
    ...(attempt.failureMessage ? { failureMessage: attempt.failureMessage } : {})
  }))

  return {
    name: params.step.name,
    command: params.step.command,
    startedAt: toIsoString(params.startedAtMs),
    endedAt: toIsoString(params.endedAtMs),
    durationMs: Math.max(0, params.endedAtMs - params.startedAtMs),
    status: params.status,
    attempts,
    ...(params.status === 'failed'
      ? {
          failure: {
            message: params.failureMessage || 'unknown error',
            exitCode: params.failureExitCode ?? null,
            domain: resolveFailureDomain(params.step)
          }
        }
      : {})
  }
}

export const syncVideoGenerateLoopStatus = (
  summary: QualitySummary,
  params: {
    step: Pick<GateStep, 'name' | 'qualityTags'>
    status: ReleaseGateStepStatus
    attempts: StepAttemptResult[]
    startedAtMs: number
    endedAtMs: number
    failureMessage?: string
  }
): QualitySummary => {
  if (!hasQualityTag(params.step, QUALITY_TAG_VIDEO_GENERATE_LOOP)) return summary

  if (params.status === 'passed') {
    return {
      ...summary,
      videoGenerateLoop: {
        trackedStepName: params.step.name,
        status: 'passed',
        attempts: params.attempts.length,
        detail: `视频生成闭环步骤「${params.step.name}」已通过`,
        failureType: null,
        startedAt: toIsoString(params.startedAtMs),
        endedAt: toIsoString(params.endedAtMs)
      }
    }
  }

  const lastAttempt =
    params.attempts.length > 0 ? params.attempts[params.attempts.length - 1] : null
  const detail =
    params.failureMessage ||
    lastAttempt?.failureMessage ||
    `视频生成闭环步骤「${params.step.name}」失败`

  return {
    ...summary,
    videoGenerateLoop: {
      trackedStepName: params.step.name,
      status: 'failed',
      attempts: params.attempts.length,
      detail,
      failureType: classifyVideoGenerateLoopFailure(detail),
      startedAt: toIsoString(params.startedAtMs),
      endedAt: toIsoString(params.endedAtMs)
    }
  }
}

export const syncRealE2EStatus = (
  summary: QualitySummary,
  params: {
    step: Pick<GateStep, 'name' | 'qualityTags'>
    status: ReleaseGateStepStatus
    attempts: StepAttemptResult[]
    startedAtMs: number
    endedAtMs: number
    failureMessage?: string
  }
): QualitySummary => {
  if (!hasQualityTag(params.step, QUALITY_TAG_REAL_E2E)) return summary

  if (params.status === 'passed') {
    return {
      ...summary,
      realE2E: {
        trackedStepName: params.step.name,
        status: 'passed',
        attempts: params.attempts.length,
        detail: `真实回归步骤「${params.step.name}」已通过`,
        failureType: null,
        startedAt: toIsoString(params.startedAtMs),
        endedAt: toIsoString(params.endedAtMs)
      }
    }
  }

  const lastAttempt =
    params.attempts.length > 0 ? params.attempts[params.attempts.length - 1] : null
  const detail =
    params.failureMessage ||
    lastAttempt?.failureMessage ||
    `真实回归步骤「${params.step.name}」失败`

  return {
    ...summary,
    realE2E: {
      trackedStepName: params.step.name,
      status: 'failed',
      attempts: params.attempts.length,
      detail,
      failureType: classifyRealE2EFailure(detail),
      startedAt: toIsoString(params.startedAtMs),
      endedAt: toIsoString(params.endedAtMs)
    }
  }
}

const buildRecommendations = (summary: QualitySummary, status: ReleaseGateStatus) => {
  if (status !== 'failed') return []

  const recommendations: string[] = []
  const failedSteps = summary.steps.filter((step) => step.status === 'failed')
  const failedDomains: FailureDomain[] = []
  const extractMissingRealEnvKeys = (message: string) => {
    const matched = message.match(/缺少真实回归必需环境变量：(.+?)。/)
    if (!matched?.[1]) return []
    return matched[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  for (const step of failedSteps) {
    if (step.name === REAL_E2E_PRECHECK_STEP_NAME) {
      const missingKeys = extractMissingRealEnvKeys(String(step.failure?.message || ''))
      const exportHints =
        missingKeys.length > 0
          ? missingKeys
              .map((key) => {
                if (key === 'GEMINI_API_KEYS') {
                  return '`export GEMINI_API_KEYS=<your_keys>`'
                }
                if (key === 'E2E_REAL_CHANNELS' || key === 'E2E_REAL_CHANNELS=true') {
                  return '`export E2E_REAL_CHANNELS=true`'
                }
                return `\`export ${key}=<value>\``
              })
              .join('、')
          : '`bun run release:real:precheck`'
      uniquePush(
        recommendations,
        `请先配置真实回归凭据：${exportHints}，再执行 \`bun run release:gate:real\`。`
      )
    } else {
      uniquePush(recommendations, `优先单独复现失败步骤「${step.name}」：\`${step.command}\`。`)
    }
    const domain =
      step.failure?.domain ||
      resolveFailureDomain({
        name: step.name,
        command: step.command
      })
    if (!failedDomains.includes(domain)) {
      failedDomains.push(domain)
    }
  }

  if (!failedDomains.length) {
    failedDomains.push('unknown')
  }

  for (const domain of failedDomains) {
    uniquePush(recommendations, DOMAIN_RECOMMENDATIONS[domain])
  }
  if (summary.videoGenerateLoop.status === 'failed') {
    uniquePush(
      recommendations,
      '视频生成闭环失败：先执行 `bun run e2e:regression -- --workers=1` 定位“注册/组织/工作区/生成/导出”链路。'
    )
    if (summary.videoGenerateLoop.failureType === 'auth') {
      uniquePush(recommendations, '检测到鉴权类失败：优先核对真实渠道凭据与令牌作用域。')
    } else if (summary.videoGenerateLoop.failureType === 'quota') {
      uniquePush(recommendations, '检测到配额/限流失败：优先检查 provider 配额与组织并发额度。')
    } else if (summary.videoGenerateLoop.failureType === 'timeout') {
      uniquePush(recommendations, '检测到超时失败：优先检查网络连通性、超时阈值与重试策略。')
    } else if (summary.videoGenerateLoop.failureType === 'upstream_5xx') {
      uniquePush(recommendations, '检测到上游 5xx 失败：建议记录 trace 并回退至稳定模型通道。')
    }
  } else if (summary.videoGenerateLoop.status === 'not-run') {
    uniquePush(
      recommendations,
      `视频生成闭环步骤「${summary.videoGenerateLoop.trackedStepName}」未执行，请先修复前置失败步骤后再重跑门禁。`
    )
  }
  if (summary.realE2E.status === 'failed') {
    uniquePush(
      recommendations,
      '真实渠道回归失败：建议先执行 `bun run e2e:regression:real -- --workers=1` 单独复现。'
    )
    if (summary.realE2E.failureType === 'auth') {
      uniquePush(
        recommendations,
        '真实渠道鉴权失败：优先核对当前 real provider 凭据（如 `GEMINI_API_KEYS`）与供应商权限。'
      )
    } else if (summary.realE2E.failureType === 'quota') {
      uniquePush(recommendations, '真实渠道配额/限流失败：优先检查供应商额度与组织并发配额。')
    } else if (summary.realE2E.failureType === 'timeout') {
      uniquePush(recommendations, '真实渠道超时失败：优先检查出口网络、超时阈值与重试参数。')
    } else if (summary.realE2E.failureType === 'upstream_5xx') {
      uniquePush(recommendations, '真实渠道上游 5xx：建议记录 trace 并切换到稳定通道后重试。')
    }
  }
  uniquePush(recommendations, '修复完成后执行 `bun run release:gate` 做一次全链路复验。')

  return recommendations
}

export const finalizeQualitySummary = (
  summary: QualitySummary,
  params: {
    status: ReleaseGateStatus
    generatedAt?: string
    failureMessage?: string
  }
): QualitySummary => {
  const recommendations = buildRecommendations(summary, params.status)
  const base: QualitySummary = {
    ...summary,
    status: params.status,
    generatedAt: params.generatedAt || new Date().toISOString(),
    recommendations
  }

  if (params.status === 'failed') {
    return {
      ...base,
      failure: {
        message: params.failureMessage || 'unknown error'
      }
    }
  }

  const { failure, ...clean } = base
  return clean
}

interface PlaywrightResultCounters {
  passed: number
  failed: number
  skipped: number
  flaky: number
  timedOut: number
  interrupted: number
  didNotRun: number
}

const createPlaywrightResultCounters = (): PlaywrightResultCounters => ({
  passed: 0,
  failed: 0,
  skipped: 0,
  flaky: 0,
  timedOut: 0,
  interrupted: 0,
  didNotRun: 0
})

export const parsePlaywrightResultCounters = (output: string): PlaywrightResultCounters => {
  const counters = createPlaywrightResultCounters()
  const pattern = /(\d+)\s+(passed|failed|skipped|flaky|timed out|interrupted|did not run)\b/gi
  let match: RegExpExecArray | null = null
  while ((match = pattern.exec(String(output || '')))) {
    const amount = Number.parseInt(String(match[1] || '0'), 10)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const label = String(match[2] || '').toLowerCase()
    if (label === 'passed') counters.passed += amount
    if (label === 'failed') counters.failed += amount
    if (label === 'skipped') counters.skipped += amount
    if (label === 'flaky') counters.flaky += amount
    if (label === 'timed out') counters.timedOut += amount
    if (label === 'interrupted') counters.interrupted += amount
    if (label === 'did not run') counters.didNotRun += amount
  }
  return counters
}

export const validateRealE2EExecution = (output: string): string | null => {
  const counters = parsePlaywrightResultCounters(output)
  const executed =
    counters.passed + counters.failed + counters.flaky + counters.timedOut + counters.interrupted
  if (executed > 0) return null
  return '未执行任何 real E2E 用例（全部 skipped 或未匹配）。请先配置真实渠道凭据后重试，或移除 --with-real-e2e。'
}
