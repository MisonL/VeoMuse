import fs from 'fs/promises'
import path from 'path'

interface GateStep {
  name: string
  command: string
  env?: Record<string, string>
  retries?: number
}

type SloMode = 'soft' | 'hard'
type SloBootstrapStatus = 'reused' | 'started' | 'skipped'
type ReleaseGateStatus = 'passed' | 'failed'
type ReleaseGateStepStatus = 'passed' | 'failed'
type ReleaseGateStepAttemptStatus = 'passed' | 'failed'
type QualitySloBootstrapStatus = SloBootstrapStatus | 'not-needed' | 'failed'
type FailureDomain = 'security' | 'build' | 'test' | 'e2e' | 'slo' | 'unknown'

interface SloBootstrapResult {
  status: SloBootstrapStatus
  detail: string
  process?: Bun.Subprocess
}

interface StepAttemptResult {
  attempt: number
  startedAtMs: number
  endedAtMs: number
  durationMs: number
  status: ReleaseGateStepAttemptStatus
  exitCode: number | null
  failureMessage?: string
}

interface QualitySummaryStepAttempt {
  attempt: number
  startedAt: string
  endedAt: string
  durationMs: number
  status: ReleaseGateStepAttemptStatus
  exitCode: number | null
  failureMessage?: string
}

interface QualitySummaryStep {
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

interface QualitySummary {
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
  steps: QualitySummaryStep[]
  recommendations: string[]
  failure?: {
    message: string
  }
}

class ReleaseGateStepError extends Error {
  readonly exitCode: number | null
  readonly attempts: StepAttemptResult[]

  constructor(message: string, params: { exitCode: number | null; attempts: StepAttemptResult[] }) {
    super(message)
    this.name = 'ReleaseGateStepError'
    this.exitCode = params.exitCode
    this.attempts = params.attempts
  }
}

const DEFAULT_SLO_API_BASE = 'http://127.0.0.1:33117'
const DEFAULT_SLO_BOOTSTRAP_TIMEOUT_MS = 15_000
const DEFAULT_SLO_HEALTH_TIMEOUT_MS = 1_200
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1'])
const QUALITY_SUMMARY_RELATIVE_PATH = path.join('artifacts', 'quality-summary.json')
const FAILURE_DOMAIN_RULES: Array<{
  domain: Exclude<FailureDomain, 'unknown'>
  patterns: RegExp[]
}> = [
  {
    domain: 'security',
    patterns: [/\bsecurity\b/i, /\bsecret(s)?\b/i, /\bgitleaks?\b/i]
  },
  {
    domain: 'build',
    patterns: [/\bbuild\b/i, /\bcompile\b/i, /\bbundle\b/i, /\btsc\b/i]
  },
  {
    domain: 'e2e',
    patterns: [/\be2e\b/i, /\bplaywright\b/i, /\bsmoke\b/i, /\bregression\b/i]
  },
  {
    domain: 'slo',
    patterns: [/\bslo\b/i, /\/api\/health/i]
  },
  {
    domain: 'test',
    patterns: [/\bunit test(s)?\b/i, /\btest(s)?\b/i, /\bjest\b/i, /\bvitest\b/i]
  }
]

const DOMAIN_RECOMMENDATIONS: Record<FailureDomain, string> = {
  security: '先执行 `bun run security:scan` 修复敏感信息或高危配置，再重新触发门禁。',
  build: '先本地执行 `bun run build` 修复编译或打包错误，再继续后续校验。',
  test: '先执行 `bun run test -- --max-concurrency 1` 修复失败用例并补充必要断言。',
  e2e: '先按失败场景单独执行对应 E2E 命令（smoke/regression）定位根因，再重跑门禁。',
  slo: '先确认 `/api/health` 可达与 SLO 样本充足，再执行 `bun run scripts/slo_gate.ts` 校验。',
  unknown: '根据失败日志定位根因，补充可复现命令后重新执行门禁。'
}

const parseBoolean = (value: string | undefined) => {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const toIsoString = (timestampMs: number) => new Date(timestampMs).toISOString()

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
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

const uniquePush = (items: string[], item: string) => {
  if (!item || items.includes(item)) return
  items.push(item)
}

const buildRecommendations = (summary: QualitySummary, status: ReleaseGateStatus) => {
  if (status !== 'failed') return []

  const recommendations: string[] = []
  const failedSteps = summary.steps.filter((step) => step.status === 'failed')
  const failedDomains: FailureDomain[] = []

  for (const step of failedSteps) {
    uniquePush(recommendations, `优先单独复现失败步骤「${step.name}」：\`${step.command}\`。`)
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
  uniquePush(recommendations, '修复完成后执行 `bun run release:gate` 做一次全链路复验。')

  return recommendations
}

export const parseSloMode = (value: string | undefined): SloMode | null => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (normalized === 'hard' || normalized === 'soft') return normalized
  return null
}

export const parseArgValue = (argv: string[], flag: string) => {
  const eqPrefix = `${flag}=`
  for (let index = 0; index < argv.length; index += 1) {
    const item = String(argv[index] || '')
    if (item === flag) {
      return String(argv[index + 1] || '').trim()
    }
    if (item.startsWith(eqPrefix)) {
      return item.slice(eqPrefix.length).trim()
    }
  }
  return ''
}

export const isCiEnvironment = (env: NodeJS.ProcessEnv) => {
  return parseBoolean(env.CI) || parseBoolean(env.GITHUB_ACTIONS)
}

const resolveCurrentBranch = (env: NodeJS.ProcessEnv) => {
  const refName = String(env.GITHUB_REF_NAME || '').trim()
  if (refName) return refName

  const ref = String(env.GITHUB_REF || '').trim()
  if (ref.startsWith('refs/heads/')) {
    return ref.slice('refs/heads/'.length)
  }

  const result = Bun.spawnSync(['zsh', '-lc', 'git branch --show-current'], {
    cwd: process.cwd(),
    env,
    stdout: 'pipe',
    stderr: 'ignore'
  })
  if (result.exitCode === 0) {
    const branch = result.stdout.toString().trim()
    if (branch) return branch
  }
  return ''
}

export const resolveSloMode = (params: {
  env: NodeJS.ProcessEnv
  currentBranch: string
  isCi: boolean
}): SloMode => {
  const explicitMode = parseSloMode(params.env.RELEASE_SLO_MODE || params.env.SLO_GATE_MODE)
  if (explicitMode) return explicitMode
  if (params.isCi) {
    return params.currentBranch === 'main' ? 'hard' : 'soft'
  }
  return 'soft'
}

export const resolveSloApiBase = (params: { argv: string[]; env: NodeJS.ProcessEnv }) => {
  const raw =
    parseArgValue(params.argv, '--api-base') ||
    params.env.SLO_GATE_API_BASE ||
    params.env.API_BASE_URL ||
    DEFAULT_SLO_API_BASE
  return raw.trim().replace(/\/+$/, '')
}

export const isLocalSloApiBase = (apiBase: string) => {
  try {
    const url = new URL(apiBase)
    return LOOPBACK_HOSTS.has(url.hostname.trim().toLowerCase())
  } catch {
    return false
  }
}

export const resolveSloBootstrapEnabled = (params: {
  env: NodeJS.ProcessEnv
  isCi: boolean
  apiBase: string
}) => {
  const raw = String(params.env.RELEASE_GATE_SLO_BOOTSTRAP || '').trim()
  if (raw) return parseBoolean(raw)
  if (params.isCi) return false
  return isLocalSloApiBase(params.apiBase)
}

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
    ...(attempt.failureMessage
      ? {
          failureMessage: attempt.failureMessage
        }
      : {})
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

const resolveSloBootstrapTimeoutMs = (env: NodeJS.ProcessEnv) =>
  parsePositiveInt(env.RELEASE_GATE_SLO_BOOTSTRAP_TIMEOUT_MS, DEFAULT_SLO_BOOTSTRAP_TIMEOUT_MS)

const resolveSloHealthTimeoutMs = (env: NodeJS.ProcessEnv) =>
  parsePositiveInt(env.RELEASE_GATE_SLO_HEALTH_TIMEOUT_MS, DEFAULT_SLO_HEALTH_TIMEOUT_MS)

const quoteShellArg = (value: string) => JSON.stringify(value)

export const buildSloGateCommand = (mode: SloMode, apiBase: string) => {
  return `bun run scripts/slo_gate.ts --mode ${mode} --api-base ${quoteShellArg(apiBase)}`
}

const createSteps = (params: { sloMode: SloMode; runRealE2E: boolean; sloApiBase: string }) => {
  const steps: GateStep[] = [
    { name: 'Secrets Scan', command: 'bun run security:scan' },
    { name: 'Build', command: 'bun run build' },
    {
      name: 'Unit Tests',
      command: 'bun run test -- --max-concurrency 1',
      env: { NODE_ENV: 'test' }
    },
    { name: 'E2E Smoke', command: 'bun run e2e:smoke -- --workers=1', retries: 1 },
    {
      name: 'E2E Regression (Mock)',
      command: 'bun run e2e:regression:mock -- --workers=1',
      retries: 1
    },
    {
      name: `SLO Check (${params.sloMode})`,
      command: buildSloGateCommand(params.sloMode, params.sloApiBase)
    }
  ]

  if (params.runRealE2E) {
    steps.push({
      name: 'E2E Regression (Real)',
      command: 'bun run e2e:regression:real -- --workers=1',
      env: { E2E_REAL_CHANNELS: 'true' }
    })
  }

  return steps
}

const runStep = async (
  step: GateStep,
  env: NodeJS.ProcessEnv
): Promise<{ attempts: StepAttemptResult[] }> => {
  const attempts: StepAttemptResult[] = []
  const maxAttempts = Math.max(1, (step.retries || 0) + 1)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(
      `\n[release-gate] >>> ${step.name}${maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ''}`
    )
    const startedAtMs = Date.now()
    const proc = Bun.spawn(['zsh', '-lc', step.command], {
      cwd: process.cwd(),
      env: {
        ...env,
        ...(step.env || {})
      },
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit'
    })

    const code = await proc.exited
    const endedAtMs = Date.now()
    const duration = endedAtMs - startedAtMs

    if (code === 0) {
      attempts.push({
        attempt,
        startedAtMs,
        endedAtMs,
        durationMs: duration,
        status: 'passed',
        exitCode: 0
      })
      console.log(`[release-gate] <<< ${step.name} passed (${duration}ms)`)
      return { attempts }
    }

    const exitCode = code ?? null
    const failureMessage = `${step.name} failed with exit code ${exitCode ?? 'null'} (${duration}ms)`
    attempts.push({
      attempt,
      startedAtMs,
      endedAtMs,
      durationMs: duration,
      status: 'failed',
      exitCode,
      failureMessage
    })

    if (attempt >= maxAttempts) {
      throw new ReleaseGateStepError(failureMessage, {
        exitCode,
        attempts
      })
    }

    console.warn(`[release-gate] ${step.name} failed (exit ${exitCode ?? 'null'}), retrying...`)
  }

  throw new ReleaseGateStepError(`${step.name} failed`, {
    exitCode: null,
    attempts
  })
}

const checkSloApiHealth = async (apiBase: string, timeoutMs: number) => {
  try {
    const response = await fetch(`${apiBase}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) {
      return { ok: false, reason: `health-check-http-${response.status}` }
    }
    const payload = (await response.json().catch(() => null)) as { status?: string } | null
    const status = String(payload?.status || '')
      .trim()
      .toLowerCase()
    if (status && status !== 'ok') {
      return { ok: false, reason: `health-check-status-${status}` }
    }
    return { ok: true, reason: 'health-ok' }
  } catch (error: any) {
    const message = String(error?.message || error || 'health-check-failed').toLowerCase()
    if (message.includes('timed out') || message.includes('timeout'))
      return { ok: false, reason: 'health-check-timeout' }
    if (
      message.includes('failed to fetch') ||
      message.includes('unable to connect') ||
      message.includes('econnrefused')
    ) {
      return { ok: false, reason: 'health-check-unreachable' }
    }
    return {
      ok: false,
      reason: `health-check-error:${String(error?.message || error || 'unknown')}`
    }
  }
}

const waitForExit = async (process: Bun.Subprocess, timeoutMs: number) => {
  const result = await Promise.race([
    process.exited.then((code) => ({ done: true as const, code })),
    Bun.sleep(timeoutMs).then(() => ({ done: false as const, code: null }))
  ])
  return result
}

const stopBootstrapProcess = async (process: Bun.Subprocess) => {
  try {
    process.kill('SIGTERM')
  } catch {
    // noop
  }
  const graceful = await waitForExit(process, 1_500)
  if (graceful.done) return graceful.code

  try {
    process.kill('SIGKILL')
  } catch {
    // noop
  }
  const forced = await waitForExit(process, 1_500)
  return forced.done ? forced.code : null
}

const ensureSloAvailability = async (params: {
  apiBase: string
  env: NodeJS.ProcessEnv
  isCi: boolean
}): Promise<SloBootstrapResult> => {
  const healthTimeoutMs = resolveSloHealthTimeoutMs(params.env)
  const firstCheck = await checkSloApiHealth(params.apiBase, healthTimeoutMs)
  if (firstCheck.ok) {
    return {
      status: 'reused',
      detail: firstCheck.reason
    }
  }

  const bootstrapEnabled = resolveSloBootstrapEnabled({
    env: params.env,
    isCi: params.isCi,
    apiBase: params.apiBase
  })
  if (!bootstrapEnabled) {
    return {
      status: 'skipped',
      detail: `${firstCheck.reason}; bootstrap-disabled`
    }
  }

  const bootstrapEnv: NodeJS.ProcessEnv = { ...params.env }
  try {
    const url = new URL(params.apiBase)
    if (url.port) bootstrapEnv.PORT = url.port
  } catch {
    // noop
  }

  const backendProc = Bun.spawn({
    cmd: ['bun', 'run', '--cwd', 'apps/backend', 'dev'],
    cwd: process.cwd(),
    env: bootstrapEnv,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'ignore'
  })

  const deadline = Date.now() + resolveSloBootstrapTimeoutMs(params.env)
  let lastReason = firstCheck.reason

  while (Date.now() < deadline) {
    const health = await checkSloApiHealth(params.apiBase, healthTimeoutMs)
    if (health.ok) {
      return {
        status: 'started',
        detail: health.reason,
        process: backendProc
      }
    }
    lastReason = health.reason || lastReason

    const exited = await waitForExit(backendProc, 200)
    if (exited.done) {
      throw new Error(`SLO bootstrap backend exited early (code=${exited.code ?? 'null'})`)
    }

    await Bun.sleep(250)
  }

  await stopBootstrapProcess(backendProc)
  throw new Error(
    `SLO API unavailable after bootstrap timeout (${resolveSloBootstrapTimeoutMs(params.env)}ms), reason=${lastReason}`
  )
}

const resolveQualitySummaryPath = (cwd = process.cwd()) =>
  path.resolve(cwd, QUALITY_SUMMARY_RELATIVE_PATH)

const writeQualitySummary = async (summary: QualitySummary) => {
  const summaryPath = resolveQualitySummaryPath()
  await fs.mkdir(path.dirname(summaryPath), { recursive: true })
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(`[release-gate] quality summary written: ${QUALITY_SUMMARY_RELATIVE_PATH}`)
}

const extractFailureInfo = (error: unknown) => {
  if (error instanceof ReleaseGateStepError) {
    return {
      message: error.message,
      exitCode: error.exitCode,
      attempts: error.attempts
    }
  }

  return {
    message: toErrorMessage(error),
    exitCode: null,
    attempts: [] as StepAttemptResult[]
  }
}

export const runReleaseGate = async (argv = process.argv.slice(2), env = process.env) => {
  const argSet = new Set(argv)
  const runRealE2E = argSet.has('--with-real-e2e') || env.RELEASE_GATE_REAL_E2E === 'true'
  const branch = resolveCurrentBranch(env) || '(unknown)'
  const ci = isCiEnvironment(env)
  const sloMode = resolveSloMode({
    env,
    currentBranch: branch === '(unknown)' ? '' : branch,
    isCi: ci
  })
  const sloApiBase = resolveSloApiBase({ argv, env })
  const sloBootstrapEnabled = resolveSloBootstrapEnabled({
    env,
    isCi: ci,
    apiBase: sloApiBase
  })
  const steps = createSteps({ sloMode, runRealE2E, sloApiBase })
  let bootstrapProc: Bun.Subprocess | null = null
  let gateError: unknown = null
  let summary = createQualitySummary({
    branch,
    ci,
    sloMode,
    sloApiBase,
    runRealE2E,
    sloBootstrapEnabled
  })

  console.log(
    `[release-gate] start (branch=${branch}, ci=${ci}, sloMode=${sloMode}, sloApiBase=${sloApiBase})`
  )

  try {
    for (const step of steps) {
      const stepStartedAtMs = Date.now()
      try {
        if (step.name.startsWith('SLO Check')) {
          const bootstrapStartedAt = new Date().toISOString()
          try {
            const bootstrap = await ensureSloAvailability({
              apiBase: sloApiBase,
              env,
              isCi: ci
            })
            summary = {
              ...summary,
              sloBootstrap: {
                ...summary.sloBootstrap,
                status: bootstrap.status,
                detail: bootstrap.detail,
                startedAt: bootstrapStartedAt,
                endedAt: new Date().toISOString()
              }
            }
            console.log(`[release-gate] slo bootstrap: ${bootstrap.status} (${bootstrap.detail})`)
            if (bootstrap.process) bootstrapProc = bootstrap.process
          } catch (error: unknown) {
            summary = {
              ...summary,
              sloBootstrap: {
                ...summary.sloBootstrap,
                status: 'failed',
                detail: toErrorMessage(error),
                startedAt: bootstrapStartedAt,
                endedAt: new Date().toISOString()
              }
            }
            throw error
          }
        }

        const stepResult = await runStep(step, env)
        const stepEndedAtMs = Date.now()
        summary = {
          ...summary,
          steps: [
            ...summary.steps,
            buildQualitySummaryStep({
              step,
              status: 'passed',
              startedAtMs: stepStartedAtMs,
              endedAtMs: stepEndedAtMs,
              attempts: stepResult.attempts
            })
          ]
        }
      } catch (error: unknown) {
        const stepEndedAtMs = Date.now()
        const failure = extractFailureInfo(error)
        summary = {
          ...summary,
          steps: [
            ...summary.steps,
            buildQualitySummaryStep({
              step,
              status: 'failed',
              startedAtMs: stepStartedAtMs,
              endedAtMs: stepEndedAtMs,
              attempts: failure.attempts,
              failureMessage: failure.message,
              failureExitCode: failure.exitCode
            })
          ]
        }
        throw error
      }
    }

    summary = finalizeQualitySummary(summary, {
      status: 'passed'
    })
  } catch (error: unknown) {
    gateError = error
    summary = finalizeQualitySummary(summary, {
      status: 'failed',
      failureMessage: toErrorMessage(error)
    })
  } finally {
    if (bootstrapProc) {
      const code = await stopBootstrapProcess(bootstrapProc)
      summary = {
        ...summary,
        sloBootstrap: {
          ...summary.sloBootstrap,
          endedAt: new Date().toISOString(),
          stopExitCode: code
        }
      }
      console.log(`[release-gate] slo bootstrap: stopped (exit=${code ?? 'unknown'})`)
    }

    try {
      await writeQualitySummary(summary)
    } catch (error: unknown) {
      console.error(`[release-gate] failed to write quality summary: ${toErrorMessage(error)}`)
    }
  }

  if (gateError) {
    throw gateError
  }

  console.log('\n[release-gate] all checks passed')
}

if (import.meta.main) {
  runReleaseGate().catch((error: any) => {
    console.error(`\n[release-gate] failed: ${error?.message || 'unknown error'}`)
    process.exit(1)
  })
}
