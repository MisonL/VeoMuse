import {
  buildRealE2EPrecheckMessage,
  buildSloGateCommand,
  createSteps,
  isCiEnvironment,
  isLocalSloApiBase,
  parseArgValue,
  parseSloMode,
  REAL_E2E_PRECHECK_COMMAND,
  REAL_E2E_PRECHECK_STEP_NAME,
  resolveRealE2EPrecheckMissingEnv,
  resolveSloApiBase,
  resolveSloBootstrapEnabled,
  resolveSloCheckRetries,
  resolveSloMode
} from './release-gate/config'
import type { QualitySummary } from './release-gate/contracts'
import {
  buildQualitySummaryStep,
  classifyRealE2EFailure,
  classifyVideoGenerateLoopFailure,
  createQualitySummary,
  finalizeQualitySummary,
  parsePlaywrightResultCounters,
  resolveFailureDomain,
  syncRealE2EStatus,
  syncVideoGenerateLoopStatus,
  validateRealE2EExecution
} from './release-gate/summary'
import {
  ensureSloAvailability,
  extractFailureInfo,
  resolveCurrentBranch,
  runStep,
  stopBootstrapProcess,
  toRuntimeErrorMessage,
  writeQualitySummary
} from './release-gate/runtime'

export {
  buildRealE2EPrecheckMessage,
  buildQualitySummaryStep,
  buildSloGateCommand,
  classifyRealE2EFailure,
  classifyVideoGenerateLoopFailure,
  createQualitySummary,
  finalizeQualitySummary,
  isCiEnvironment,
  isLocalSloApiBase,
  parseArgValue,
  parsePlaywrightResultCounters,
  parseSloMode,
  resolveFailureDomain,
  resolveRealE2EPrecheckMissingEnv,
  resolveSloApiBase,
  resolveSloBootstrapEnabled,
  resolveSloMode,
  validateRealE2EExecution
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
  const sloCheckRetries = resolveSloCheckRetries({ argv, env })
  const steps = createSteps({ sloMode, runRealE2E, sloApiBase, sloCheckRetries })
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
    if (runRealE2E) {
      const missingEnv = resolveRealE2EPrecheckMissingEnv(env)
      if (missingEnv.length) {
        const nowMs = Date.now()
        const precheckMessage = buildRealE2EPrecheckMessage(missingEnv)
        summary = {
          ...summary,
          steps: [
            ...summary.steps,
            buildQualitySummaryStep({
              step: {
                name: REAL_E2E_PRECHECK_STEP_NAME,
                command: REAL_E2E_PRECHECK_COMMAND
              },
              status: 'failed',
              startedAtMs: nowMs,
              endedAtMs: nowMs,
              attempts: [],
              failureMessage: precheckMessage,
              failureExitCode: null
            })
          ]
        }
        throw new Error(precheckMessage)
      }
    }

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
                detail: toRuntimeErrorMessage(error),
                startedAt: bootstrapStartedAt,
                endedAt: new Date().toISOString()
              }
            }
            throw error
          }
        }

        const stepResult = await runStep(step, env)
        const stepEndedAtMs = Date.now()
        const nextSummary: QualitySummary = {
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
        const loopSyncedSummary = syncVideoGenerateLoopStatus(nextSummary, {
          step,
          status: 'passed',
          attempts: stepResult.attempts,
          startedAtMs: stepStartedAtMs,
          endedAtMs: stepEndedAtMs
        })
        summary = syncRealE2EStatus(loopSyncedSummary, {
          step,
          status: 'passed',
          attempts: stepResult.attempts,
          startedAtMs: stepStartedAtMs,
          endedAtMs: stepEndedAtMs
        })
      } catch (error: unknown) {
        const stepEndedAtMs = Date.now()
        const failure = extractFailureInfo(error)
        const nextSummary: QualitySummary = {
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
        const loopSyncedSummary = syncVideoGenerateLoopStatus(nextSummary, {
          step,
          status: 'failed',
          attempts: failure.attempts,
          startedAtMs: stepStartedAtMs,
          endedAtMs: stepEndedAtMs,
          failureMessage: failure.message
        })
        summary = syncRealE2EStatus(loopSyncedSummary, {
          step,
          status: 'failed',
          attempts: failure.attempts,
          startedAtMs: stepStartedAtMs,
          endedAtMs: stepEndedAtMs,
          failureMessage: failure.message
        })
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
      failureMessage: toRuntimeErrorMessage(error)
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
      console.error(
        `[release-gate] failed to write quality summary: ${toRuntimeErrorMessage(error)}`
      )
    }
  }

  if (gateError) {
    throw gateError
  }

  console.log('\n[release-gate] all checks passed')
}

if (import.meta.main) {
  runReleaseGate().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error(`\n[release-gate] failed: ${message}`)
    process.exit(1)
  })
}
