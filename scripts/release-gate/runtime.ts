import fs from 'fs/promises'
import path from 'path'
import {
  QUALITY_SUMMARY_RELATIVE_PATH,
  type GateStep,
  type QualitySummary,
  type SloBootstrapResult,
  type StepAttemptResult
} from './contracts'
import {
  resolveSloBootstrapEnabled,
  resolveSloBootstrapTimeoutMs,
  resolveSloHealthTimeoutMs
} from './config'
import { validateRealE2EExecution } from './summary'

export class ReleaseGateStepError extends Error {
  readonly exitCode: number | null
  readonly attempts: StepAttemptResult[]

  constructor(message: string, params: { exitCode: number | null; attempts: StepAttemptResult[] }) {
    super(message)
    this.name = 'ReleaseGateStepError'
    this.exitCode = params.exitCode
    this.attempts = params.attempts
  }
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
}

const validateStepOutput = (step: GateStep, output: string): string | null => {
  if (step.outputCheck === 'require_real_e2e_executed') {
    return validateRealE2EExecution(output)
  }
  return null
}

const resolveStepExecutionCommand = (step: GateStep) => {
  if (Array.isArray(step.commandArgs) && step.commandArgs.length > 0) {
    return step.commandArgs
  }
  throw new Error(`[release-gate] invalid step command args: ${step.name}`)
}

const streamToBuffer = async (
  stream: ReadableStream<Uint8Array> | null | undefined,
  sink: (text: string) => void
) => {
  if (!stream) return ''
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    const text = decoder.decode(value)
    buffer += text
    sink(text)
  }
  return buffer
}

export const runStep = async (
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
    const shouldCaptureOutput = Boolean(step.outputCheck)
    const proc = Bun.spawn(resolveStepExecutionCommand(step), {
      cwd: process.cwd(),
      env: {
        ...env,
        ...(step.env || {})
      },
      stdout: shouldCaptureOutput ? 'pipe' : 'inherit',
      stderr: shouldCaptureOutput ? 'pipe' : 'inherit',
      stdin: 'inherit'
    })
    const stdoutPromise = shouldCaptureOutput
      ? streamToBuffer(proc.stdout, (chunk) => process.stdout.write(chunk))
      : Promise.resolve('')
    const stderrPromise = shouldCaptureOutput
      ? streamToBuffer(proc.stderr, (chunk) => process.stderr.write(chunk))
      : Promise.resolve('')

    const code = await proc.exited
    const [stdoutText, stderrText] = shouldCaptureOutput
      ? await Promise.all([stdoutPromise, stderrPromise])
      : ['', '']
    const endedAtMs = Date.now()
    const duration = endedAtMs - startedAtMs
    const combinedOutput = `${stdoutText}${stderrText}`

    if (code === 0) {
      const validationError = validateStepOutput(step, combinedOutput)
      if (validationError) {
        const failureMessage = `${step.name} semantic check failed: ${validationError}`
        attempts.push({
          attempt,
          startedAtMs,
          endedAtMs,
          durationMs: duration,
          status: 'failed',
          exitCode: 0,
          failureMessage
        })

        if (attempt >= maxAttempts) {
          throw new ReleaseGateStepError(failureMessage, {
            exitCode: 0,
            attempts
          })
        }

        console.warn(`[release-gate] ${failureMessage}，重试中...`)
        continue
      }

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
    let failureMessage = `${step.name} failed with exit code ${exitCode ?? 'null'} (${duration}ms)`
    if (shouldCaptureOutput) {
      const compressedOutput = String(combinedOutput || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 320)
      if (compressedOutput) {
        failureMessage = `${failureMessage}; output: ${compressedOutput}`
      }
    }
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
  } catch (error: unknown) {
    const message = String(
      (error as { message?: string } | null | undefined)?.message || error || 'health-check-failed'
    ).toLowerCase()
    if (message.includes('timed out') || message.includes('timeout')) {
      return { ok: false, reason: 'health-check-timeout' }
    }
    if (
      message.includes('failed to fetch') ||
      message.includes('unable to connect') ||
      message.includes('econnrefused')
    ) {
      return { ok: false, reason: 'health-check-unreachable' }
    }
    return {
      ok: false,
      reason: `health-check-error:${String(
        (error as { message?: string } | null | undefined)?.message || error || 'unknown'
      )}`
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

export const stopBootstrapProcess = async (process: Bun.Subprocess) => {
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

export const ensureSloAvailability = async (params: {
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

export const writeQualitySummary = async (summary: QualitySummary) => {
  const summaryPath = resolveQualitySummaryPath()
  await fs.mkdir(path.dirname(summaryPath), { recursive: true })
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(`[release-gate] quality summary written: ${QUALITY_SUMMARY_RELATIVE_PATH}`)
}

export const extractFailureInfo = (error: unknown) => {
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

export const resolveCurrentBranch = (env: NodeJS.ProcessEnv) => {
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

export const toRuntimeErrorMessage = toErrorMessage
